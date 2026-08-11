import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { isWindows } from "./runPowerShell";
import { getNetworkInfo } from "./networkInfo";
import { getAdvancedNetworkInfo } from "./advancedNetworkInfo";
import type {
  AdvancedOptimizationSettings,
  AdvancedOptimizationStatusResult,
  BackupConfig,
  CongestionProviderKey,
  OptimizationSettings,
  OptimizationStatusResult,
} from "./types";

const execAsync = promisify(exec);

const VALID_TCP_LEVELS = new Set(["Normal", "Disabled", "Experimental", "Restricted"]);
const VALID_CONGESTION_PROVIDERS = new Set<CongestionProviderKey>(["Default", "CTCP", "NewReno", "DCTCP"]);
const VALID_DO_MODES = new Set([0, 1, 3, 99, 100]);

// Path to persistent backup file
function getBackupFilePath(): string {
  const baseDir = process.env.APPDATA || path.join(os.homedir(), ".config");
  const appDir = path.join(baseDir, "wifi-tuner");
  if (!fs.existsSync(appDir)) {
    fs.mkdirSync(appDir, { recursive: true });
  }
  return path.join(appDir, "backup.json");
}

export function readBackupConfig(): BackupConfig | null {
  try {
    const file = getBackupFilePath();
    if (!fs.existsSync(file)) return null;
    const content = fs.readFileSync(file, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function saveBackupConfig(config: BackupConfig): void {
  try {
    const file = getBackupFilePath();
    fs.writeFileSync(file, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error("Lỗi khi lưu tệp sao lưu:", err);
  }
}

export function clearBackupConfig(): void {
  try {
    const file = getBackupFilePath();
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch (err) {
    console.error("Lỗi khi xóa tệp sao lưu:", err);
  }
}

export async function getOptimizationStatus(): Promise<OptimizationStatusResult> {
  const currentInfo = await getNetworkInfo();
  const backup = readBackupConfig();

  if (currentInfo.platform === "mock") {
    return {
      platform: "mock",
      isOptimized: true,
      dnsStatus: "optimized",
      tcpStatus: "optimized",
      powerStatus: "optimized",
      backup: backup || {
        createdAt: new Date().toISOString(),
        dns: ["192.168.1.1"],
        tcpAutoTuning: "Disabled",
        powerAllowTurnOff: "Enabled",
      },
    };
  }

  // Determine current status
  const currentDns = currentInfo.dns;
  const isCloudflare = currentDns.includes("1.1.1.1");
  const isGoogle = currentDns.includes("8.8.8.8");
  const isQuad9 = currentDns.includes("9.9.9.9");
  const dnsStatus = isCloudflare || isGoogle || isQuad9 ? "optimized" : "suboptimal";

  const tcpLevel = currentInfo.tcp?.autoTuningLevel?.toLowerCase() ?? "";
  const tcpStatus = tcpLevel === "normal" ? "optimized" : "suboptimal";

  const powerState = currentInfo.power?.allowComputerToTurnOffDevice?.toLowerCase() ?? "";
  const powerStatus = powerState === "disabled" || powerState === "false" ? "optimized" : "suboptimal";

  const isOptimized = dnsStatus === "optimized" && tcpStatus === "optimized" && powerStatus === "optimized";

  return {
    platform: "win32",
    isOptimized,
    dnsStatus,
    tcpStatus,
    powerStatus,
    backup,
  };
}

function isValidIPv4(value: unknown): value is string {
  return typeof value === "string" && net.isIPv4(value);
}

function isValidDnsList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isValidIPv4);
}

function isValidCongestionProvider(value: unknown): value is CongestionProviderKey {
  return typeof value === "string" && VALID_CONGESTION_PROVIDERS.has(value as CongestionProviderKey);
}

function isValidDoMode(value: unknown): value is number {
  return typeof value === "number" && VALID_DO_MODES.has(value);
}

// Xác định danh sách DNS sẽ áp dụng từ settings do client gửi lên.
// Trả về:
//   [] (mảng rỗng)  -> reset DNS về DHCP (tự động)
//   string[]        -> danh sách DNS hợp lệ cần áp dụng
//   null            -> cấu hình không hợp lệ, PHẢI từ chối request (không được
//                       âm thầm bỏ qua bước đổi DNS như trước — đó là lỗi đã gặp
//                       khi DNS Benchmark gửi các preset lạ như "opendns").
// customDns (nếu có) luôn được validate là địa chỉ IPv4 hợp lệ trước khi dùng —
// đây cũng là hàng rào chặn chèn lệnh PowerShell, vì giá trị đã qua validate
// không còn chứa ký tự đặc biệt nào để thoát khỏi ngữ cảnh script.
function resolveDnsList(settings: OptimizationSettings): string[] | null {
  if (settings.dnsPreset === "dhcp") return [];

  if (settings.customDns !== undefined) {
    return isValidDnsList(settings.customDns) ? settings.customDns : null;
  }

  switch (settings.dnsPreset) {
    case "cloudflare":
      return ["1.1.1.1", "1.0.0.1"];
    case "google":
      return ["8.8.8.8", "8.8.4.4"];
    case "quad9":
      return ["9.9.9.9", "149.112.112.112"];
    default:
      return null;
  }
}

interface ElevatedParams {
  dns: string[] | null;
  resetDns: boolean;
  tcpAutoTuning: string | null;
  powerAllowTurnOff: "Enabled" | "Disabled" | null;
  rssEnabled: boolean | null;
  congestionProvider: string | null;
  doDownloadMode: number | null;
}

// Thực thi script với quyền Admin (UAC) trên Windows.
//
// Mọi giá trị động (DNS list, TCP level, power setting...) được truyền qua
// một file JSON tạm, KHÔNG bao giờ nối chuỗi trực tiếp vào nội dung script —
// script PowerShell chỉ đọc `$p = Get-Content $paramsFile | ConvertFrom-Json`
// rồi dùng $p.* như object thật. Cách này loại bỏ hoàn toàn khả năng chèn
// lệnh PowerShell qua dữ liệu người dùng, kể cả nếu bước validate ở tầng gọi
// có sai sót.
//
// requireAdapter=false dùng cho các thao tác không gắn với 1 card mạng cụ
// thể (vd. reset Winsock/TCP-IP toàn hệ thống) — bỏ qua bước dò card WiFi để
// không thất bại oan khi máy tạm thời không có card WiFi khả dụng.
async function executeElevatedScript(
  scriptBody: string,
  params: Partial<ElevatedParams>,
  options: { requireAdapter?: boolean } = {}
): Promise<{ success: boolean; message?: string; error?: string }> {
  const requireAdapter = options.requireAdapter ?? true;

  if (!isWindows()) {
    return { success: true, message: "[Mock Mode] Đã thực thi với quyền Admin mô phỏng." };
  }

  const tmpDir = os.tmpdir();
  const timestamp = Date.now();
  const scriptPath = path.join(tmpDir, `wifi_tuner_elevated_${timestamp}.ps1`);
  const paramsPath = path.join(tmpDir, `wifi_tuner_params_${timestamp}.json`);
  const resultPath = path.join(tmpDir, `wifi_tuner_result_${timestamp}.json`);

  fs.writeFileSync(paramsPath, JSON.stringify(params), "utf-8");

  const adapterBlock = requireAdapter
    ? `
  $adapter = Get-NetAdapter | Where-Object {
    $_.InterfaceDescription -match 'Wireless|Wi-Fi|WLAN|802.11' -and $_.Status -ne 'Not Present'
  } | Sort-Object -Property ifIndex | Select-Object -First 1

  if (-not $adapter) {
    throw "Không tìm thấy card mạng WiFi."
  }
`
    : "";

  // Ghi kết quả bằng [System.IO.File]::WriteAllText + UTF8Encoding($false) thay
  // vì Set-Content -Encoding UTF8 — cmdlet đó chèn thêm BOM (byte-order-mark) ở
  // đầu file trên Windows PowerShell 5.1, khiến Node đọc phải chuỗi bắt đầu bằng
  // ký tự không in được và JSON.parse phía dưới báo lỗi "Unexpected token".
  const fullScript = `
$ErrorActionPreference = 'Stop'
$resultFile = "${resultPath.replace(/\\/g, "\\\\")}"
$paramsFile = "${paramsPath.replace(/\\/g, "\\\\")}"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

try {
  $p = Get-Content -Path $paramsFile -Raw | ConvertFrom-Json
${adapterBlock}
${scriptBody}

  $json = @{ success = $true; message = 'Thao tác hoàn tất thành công.' } | ConvertTo-Json -Compress
  [System.IO.File]::WriteAllText($resultFile, $json, $utf8NoBom)
} catch {
  $json = @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
  [System.IO.File]::WriteAllText($resultFile, $json, $utf8NoBom)
}
  `.trim();

  fs.writeFileSync(scriptPath, fullScript, "utf-8");

  try {
    // -WindowStyle Hidden để không hiện cửa sổ PowerShell nhấp nháy khi thao
    // tác chạy — cửa sổ xác nhận UAC của Windows vẫn hiện bình thường (đó là
    // cơ chế bảo mật của hệ điều hành, không thể/không nên ẩn).
    const cmd = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \\"${scriptPath}\\"' -Verb RunAs -WindowStyle Hidden -Wait"`;
    await execAsync(cmd, { timeout: 45000 });

    if (fs.existsSync(resultPath)) {
      // Loại bỏ BOM (nếu còn sót từ phiên bản cũ) + khoảng trắng, rồi chỉ lấy
      // đúng phần {...} đầu tiên — phòng trường hợp có ký tự thừa bao quanh
      // JSON hợp lệ (antivirus chèn log, encoding lệch...), tránh crash toàn
      // bộ thao tác chỉ vì vài ký tự rác ở đầu/cuối file kết quả.
      const rawWithBom = fs.readFileSync(resultPath, "utf-8");
      const raw = (rawWithBom.charCodeAt(0) === 0xfeff ? rawWithBom.slice(1) : rawWithBom).trim();
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      if (firstBrace === -1 || lastBrace === -1) {
        return { success: false, error: "Không đọc được kết quả từ script PowerShell." };
      }
      const res = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
      return res;
    } else {
      return { success: false, error: "Người dùng đã hủy xác thực UAC hoặc thao tác bị gián đoạn." };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Lỗi khi yêu cầu quyền Admin (UAC)." };
  } finally {
    // Cleanup temporary files
    try {
      if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
      if (fs.existsSync(paramsPath)) fs.unlinkSync(paramsPath);
      if (fs.existsSync(resultPath)) fs.unlinkSync(resultPath);
    } catch {}
  }
}

// Áp dụng bất kỳ tập con nào trong 6 thông số (mỗi giá trị null nghĩa là "giữ
// nguyên, không đổi") — dùng chung cho cả tối ưu cơ bản (DNS/TCP/Power), tối
// ưu nâng cao (RSS/Congestion Provider/Delivery Optimization) và khôi phục
// backup, để đảm bảo cả 3 luồng luôn thao tác nhất quán trên cùng 1 script.
const APPLY_SCRIPT_BODY = `
  if ($p.resetDns) {
    Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ResetServerAddresses
  } elseif ($p.dns -and @($p.dns).Count -gt 0) {
    Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses @($p.dns)
  }

  if ($p.tcpAutoTuning) {
    Set-NetTCPSetting -SettingName Internet -AutoTuningLevelLocal $p.tcpAutoTuning
  }

  if ($p.powerAllowTurnOff) {
    try {
      Set-NetAdapterPowerManagement -Name $adapter.Name -AllowComputerToTurnOffDevice $p.powerAllowTurnOff -ErrorAction SilentlyContinue
    } catch {}
  }

  if ($null -ne $p.rssEnabled) {
    try {
      if ($p.rssEnabled) { Enable-NetAdapterRss -Name $adapter.Name -ErrorAction SilentlyContinue }
      else { Disable-NetAdapterRss -Name $adapter.Name -ErrorAction SilentlyContinue }
    } catch {}
  }

  if ($p.congestionProvider) {
    Set-NetTCPSetting -SettingName Internet -CongestionProvider $p.congestionProvider
  }

  if ($null -ne $p.doDownloadMode) {
    $doPath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DeliveryOptimization\\Config'
    if (-not (Test-Path $doPath)) { New-Item -Path $doPath -Force | Out-Null }
    Set-ItemProperty -Path $doPath -Name DODownloadMode -Value ([int]$p.doDownloadMode) -Type DWord
  }
`;

// Sửa lỗi mạng bằng cách đặt lại toàn bộ ngăn xếp Winsock/TCP-IP về mặc định
// gốc — không gắn với 1 card mạng cụ thể nên chạy với requireAdapter=false.
// Đây là thao tác không thể "khôi phục" theo kiểu backup thông thường (chính
// nó LÀ hành động đặt lại), nên không đi qua backup.json.
const WINSOCK_RESET_SCRIPT_BODY = `
  & netsh winsock reset | Out-Null
  & netsh int ip reset | Out-Null
`;

// Tạo bản sao lưu MỘT LẦN DUY NHẤT chứa toàn bộ 6 thông số (DNS/TCP/Power +
// RSS/Congestion/Delivery Optimization) trước khi thay đổi bất kỳ giá trị
// nào — bất kể người dùng bấm "Tối ưu" cơ bản hay "Tối ưu nâng cao" trước.
// Trước đây mỗi luồng tự tạo backup riêng chỉ chứa phần thông số của mình,
// khiến bản khôi phục thiếu trường nếu người dùng dùng cả 2 luồng theo thứ
// tự khác nhau — gộp về 1 hàm duy nhất để tránh sai lệch đó.
async function ensureBackup(): Promise<void> {
  if (readBackupConfig()) return;

  if (!isWindows()) {
    saveBackupConfig({
      createdAt: new Date().toISOString(),
      dns: ["192.168.1.1"],
      tcpAutoTuning: "Disabled",
      powerAllowTurnOff: "Enabled",
      rssEnabled: true,
      congestionProvider: "Default",
      deliveryOptimizationDownloadMode: 3,
    });
    return;
  }

  const [currentInfo, advancedInfo] = await Promise.all([getNetworkInfo(), getAdvancedNetworkInfo()]);
  saveBackupConfig({
    createdAt: new Date().toISOString(),
    dns: currentInfo.dns,
    tcpAutoTuning: currentInfo.tcp?.autoTuningLevel || "Normal",
    powerAllowTurnOff: currentInfo.power?.allowComputerToTurnOffDevice || "Disabled",
    rssEnabled: advancedInfo.rssEnabled,
    congestionProvider: advancedInfo.congestionProvider,
    deliveryOptimizationDownloadMode: advancedInfo.deliveryOptimizationDownloadMode,
  });
}

export async function applyOptimization(settings: OptimizationSettings): Promise<{ success: boolean; message?: string; error?: string }> {
  const dnsList = resolveDnsList(settings);
  if (dnsList === null) {
    return { success: false, error: "Cấu hình DNS không hợp lệ (danh sách DNS phải là địa chỉ IPv4)." };
  }

  await ensureBackup();

  if (!isWindows()) {
    return { success: true, message: "Đã áp dụng cài đặt tối ưu (Chế độ dữ liệu mẫu)." };
  }

  const params: ElevatedParams = {
    dns: dnsList.length > 0 ? dnsList : null,
    resetDns: settings.dnsPreset === "dhcp",
    tcpAutoTuning: settings.enableTcpTuning ? "Normal" : null,
    powerAllowTurnOff: settings.disablePowerSave ? "Disabled" : null,
    rssEnabled: null,
    congestionProvider: null,
    doDownloadMode: null,
  };

  return executeElevatedScript(APPLY_SCRIPT_BODY, params);
}

export async function applyAdvancedOptimization(
  settings: AdvancedOptimizationSettings
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!isValidCongestionProvider(settings.congestionProvider)) {
    return { success: false, error: "Congestion Provider không hợp lệ." };
  }

  await ensureBackup();

  if (!isWindows()) {
    return { success: true, message: "Đã áp dụng tinh chỉnh nâng cao (Chế độ dữ liệu mẫu)." };
  }

  const params: ElevatedParams = {
    dns: null,
    resetDns: false,
    tcpAutoTuning: null,
    powerAllowTurnOff: null,
    rssEnabled: settings.enableRss,
    congestionProvider: settings.congestionProvider,
    doDownloadMode: settings.disableDeliveryOptimizationP2P ? 0 : 3,
  };

  return executeElevatedScript(APPLY_SCRIPT_BODY, params);
}

export async function resetWinsock(): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!isWindows()) {
    return {
      success: true,
      message: "[Chế độ dữ liệu mẫu] Đã đặt lại Winsock & TCP/IP. Cần khởi động lại máy để áp dụng.",
    };
  }

  const result = await executeElevatedScript(WINSOCK_RESET_SCRIPT_BODY, {}, { requireAdapter: false });
  if (result.success) {
    return { success: true, message: "Đã đặt lại Winsock & TCP/IP thành công. Vui lòng khởi động lại máy tính để áp dụng." };
  }
  return result;
}

export async function getAdvancedOptimizationStatus(): Promise<AdvancedOptimizationStatusResult> {
  const currentInfo = await getAdvancedNetworkInfo();
  const backup = readBackupConfig();

  const rssStatus = currentInfo.rssEnabled === true ? "optimized" : currentInfo.rssEnabled === false ? "suboptimal" : "unknown";
  const congestionStatus =
    currentInfo.congestionProvider === "CTCP" ? "optimized" : currentInfo.congestionProvider ? "suboptimal" : "unknown";
  const doMode = currentInfo.deliveryOptimizationDownloadMode;
  const doStatus = doMode === 0 || doMode === 99 ? "optimized" : doMode !== null ? "suboptimal" : "unknown";

  const isOptimized = rssStatus === "optimized" && congestionStatus === "optimized" && doStatus === "optimized";

  return {
    platform: currentInfo.platform,
    isOptimized,
    rssStatus,
    congestionStatus,
    doStatus,
    backup,
    advancedProperties: currentInfo.advancedProperties,
  };
}

export async function restoreBackupConfig(): Promise<{ success: boolean; message?: string; error?: string }> {
  const backup = readBackupConfig();
  if (!backup) {
    return { success: false, error: "Không tìm thấy bản sao lưu cấu hình." };
  }

  if (!isWindows()) {
    clearBackupConfig();
    return { success: true, message: "Đã khôi phục cấu hình từ bản sao lưu (Mock mode)." };
  }

  // Tệp backup do chính app ghi ra, nhưng vẫn validate lại trước khi đưa vào
  // script chạy quyền Admin — phòng trường hợp tệp bị chỉnh sửa thủ công.
  const dnsList = isValidDnsList(backup.dns) ? backup.dns : [];
  const tcpLevel = VALID_TCP_LEVELS.has(backup.tcpAutoTuning) ? backup.tcpAutoTuning : "Normal";
  const powerAllowTurnOff = backup.powerAllowTurnOff === "Enabled" ? "Enabled" : "Disabled";
  const rssEnabled = typeof backup.rssEnabled === "boolean" ? backup.rssEnabled : null;
  const congestionProvider = isValidCongestionProvider(backup.congestionProvider) ? backup.congestionProvider : null;
  const doDownloadMode = isValidDoMode(backup.deliveryOptimizationDownloadMode) ? backup.deliveryOptimizationDownloadMode : null;

  const params: ElevatedParams = {
    dns: dnsList.length > 0 ? dnsList : null,
    resetDns: dnsList.length === 0,
    tcpAutoTuning: tcpLevel,
    powerAllowTurnOff,
    rssEnabled,
    congestionProvider,
    doDownloadMode,
  };

  const result = await executeElevatedScript(APPLY_SCRIPT_BODY, params);
  if (result.success) {
    clearBackupConfig();
  }
  return result;
}
