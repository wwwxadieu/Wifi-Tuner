import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { isWindows } from "./runPowerShell";
import { getNetworkInfo } from "./networkInfo";
import type { BackupConfig, OptimizationSettings, OptimizationStatusResult } from "./types";

const execAsync = promisify(exec);

const VALID_TCP_LEVELS = new Set(["Normal", "Disabled", "Experimental", "Restricted"]);

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
}

// Thực thi script với quyền Admin (UAC) trên Windows.
//
// Mọi giá trị động (DNS list, TCP level, power setting) được truyền qua một
// file JSON tạm, KHÔNG bao giờ nối chuỗi trực tiếp vào nội dung script — script
// PowerShell chỉ đọc `$p = Get-Content $paramsFile | ConvertFrom-Json` rồi dùng
// $p.* như object thật. Cách này loại bỏ hoàn toàn khả năng chèn lệnh PowerShell
// qua dữ liệu người dùng, kể cả nếu bước validate ở tầng gọi có sai sót.
async function executeElevatedScript(
  scriptBody: string,
  params: ElevatedParams
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!isWindows()) {
    return { success: true, message: "[Mock Mode] Đã thực thi với quyền Admin mô phỏng." };
  }

  const tmpDir = os.tmpdir();
  const timestamp = Date.now();
  const scriptPath = path.join(tmpDir, `wifi_tuner_elevated_${timestamp}.ps1`);
  const paramsPath = path.join(tmpDir, `wifi_tuner_params_${timestamp}.json`);
  const resultPath = path.join(tmpDir, `wifi_tuner_result_${timestamp}.json`);

  fs.writeFileSync(paramsPath, JSON.stringify(params), "utf-8");

  const fullScript = `
$ErrorActionPreference = 'Stop'
$resultFile = "${resultPath.replace(/\\/g, "\\\\")}"
$paramsFile = "${paramsPath.replace(/\\/g, "\\\\")}"

try {
  $p = Get-Content -Path $paramsFile -Raw | ConvertFrom-Json

  $adapter = Get-NetAdapter | Where-Object {
    $_.InterfaceDescription -match 'Wireless|Wi-Fi|WLAN|802.11' -and $_.Status -ne 'Not Present'
  } | Sort-Object -Property ifIndex | Select-Object -First 1

  if (-not $adapter) {
    throw "Không tìm thấy card mạng WiFi."
  }

${scriptBody}

  @{ success = $true; message = 'Thao tác hoàn tất thành công.' } | ConvertTo-Json -Compress | Set-Content -Path $resultFile -Encoding UTF8
} catch {
  @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress | Set-Content -Path $resultFile -Encoding UTF8
}
  `.trim();

  fs.writeFileSync(scriptPath, fullScript, "utf-8");

  try {
    const cmd = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \\"${scriptPath}\\"' -Verb RunAs -Wait"`;
    await execAsync(cmd, { timeout: 45000 });

    if (fs.existsSync(resultPath)) {
      const resText = fs.readFileSync(resultPath, "utf-8");
      const res = JSON.parse(resText);
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
`;

export async function applyOptimization(settings: OptimizationSettings): Promise<{ success: boolean; message?: string; error?: string }> {
  const dnsList = resolveDnsList(settings);
  if (dnsList === null) {
    return { success: false, error: "Cấu hình DNS không hợp lệ (danh sách DNS phải là địa chỉ IPv4)." };
  }

  if (!isWindows()) {
    // Mock execution
    const currentBackup = readBackupConfig();
    if (!currentBackup) {
      saveBackupConfig({
        createdAt: new Date().toISOString(),
        dns: ["192.168.1.1"],
        tcpAutoTuning: "Disabled",
        powerAllowTurnOff: "Enabled",
      });
    }
    return { success: true, message: "Đã áp dụng cài đặt tối ưu (Chế độ dữ liệu mẫu)." };
  }

  // 1. Create backup if not existing
  const currentInfo = await getNetworkInfo();
  let backup = readBackupConfig();
  if (!backup) {
    backup = {
      createdAt: new Date().toISOString(),
      dns: currentInfo.dns,
      tcpAutoTuning: currentInfo.tcp?.autoTuningLevel || "Normal",
      powerAllowTurnOff: currentInfo.power?.allowComputerToTurnOffDevice || "Disabled",
    };
    saveBackupConfig(backup);
  }

  const params: ElevatedParams = {
    dns: dnsList.length > 0 ? dnsList : null,
    resetDns: settings.dnsPreset === "dhcp",
    tcpAutoTuning: settings.enableTcpTuning ? "Normal" : null,
    powerAllowTurnOff: settings.disablePowerSave ? "Disabled" : null,
  };

  return executeElevatedScript(APPLY_SCRIPT_BODY, params);
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

  const params: ElevatedParams = {
    dns: dnsList.length > 0 ? dnsList : null,
    resetDns: dnsList.length === 0,
    tcpAutoTuning: tcpLevel,
    powerAllowTurnOff,
  };

  const result = await executeElevatedScript(APPLY_SCRIPT_BODY, params);
  if (result.success) {
    clearBackupConfig();
  }
  return result;
}
