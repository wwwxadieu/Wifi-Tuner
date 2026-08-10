import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { isWindows } from "./runPowerShell";
import { getNetworkInfo } from "./networkInfo";
import type { BackupConfig, DnsPresetKey, OptimizationSettings, OptimizationStatusResult } from "./types";

const execAsync = promisify(exec);

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

export function resolveDnsPreset(preset: DnsPresetKey, customDns?: string[]): string[] {
  switch (preset) {
    case "cloudflare":
      return ["1.1.1.1", "1.0.0.1"];
    case "google":
      return ["8.8.8.8", "8.8.4.4"];
    case "quad9":
      return ["9.9.9.9", "149.112.112.112"];
    case "custom":
      return customDns && customDns.length > 0 ? customDns : ["1.1.1.1", "1.0.0.1"];
    case "dhcp":
    default:
      return [];
  }
}

// Executes a script with UAC Elevation on Windows
async function executeElevatedScript(scriptContent: string): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!isWindows()) {
    return { success: true, message: "[Mock Mode] Đã thực thi với quyền Admin mô phỏng." };
  }

  const tmpDir = os.tmpdir();
  const timestamp = Date.now();
  const scriptPath = path.join(tmpDir, `wifi_tuner_elevated_${timestamp}.ps1`);
  const resultPath = path.join(tmpDir, `wifi_tuner_result_${timestamp}.json`);

  // Wrap script content to output JSON result file
  const fullScript = `
$ErrorActionPreference = 'Stop'
$resultFile = "${resultPath.replace(/\\/g, "\\\\")}"

try {
${scriptContent}
  @{ success = $true; message = 'Thao tác hoàn tất thành công.' } | ConvertTo-Json -Compress | Set-Content -Path $resultFile -Encoding UTF8
} catch {
  @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress | Set-Content -Path $resultFile -Encoding UTF8
}
  `.trim();

  fs.writeFileSync(scriptPath, fullScript, "utf-8");

  try {
    // Run script via PowerShell Start-Process RunAs (Triggers Windows UAC Prompt)
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
      if (fs.existsSync(resultPath)) fs.unlinkSync(resultPath);
    } catch {}
  }
}

export async function applyOptimization(settings: OptimizationSettings): Promise<{ success: boolean; message?: string; error?: string }> {
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

  const dnsList = resolveDnsPreset(settings.dnsPreset, settings.customDns);
  const dnsFormatted = dnsList.length > 0 ? `@(${dnsList.map((d) => `'${d}'`).join(",")})` : null;

  let scriptParts: string[] = [];

  scriptParts.push(`
  $adapter = Get-NetAdapter | Where-Object {
    $_.InterfaceDescription -match 'Wireless|Wi-Fi|WLAN|802.11' -and $_.Status -ne 'Not Present'
  } | Sort-Object -Property ifIndex | Select-Object -First 1

  if (-not $adapter) {
    throw "Không tìm thấy card mạng WiFi để tối ưu hóa."
  }
  `);

  if (settings.dnsPreset === "dhcp") {
    scriptParts.push(`Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ResetServerAddresses`);
  } else if (dnsFormatted) {
    scriptParts.push(`Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses ${dnsFormatted}`);
  }

  if (settings.enableTcpTuning) {
    scriptParts.push(`Set-NetTCPSetting -SettingName Internet -AutoTuningLevelLocal Normal`);
  }

  if (settings.disablePowerSave) {
    scriptParts.push(`
    try {
      Set-NetAdapterPowerManagement -Name $adapter.Name -AllowComputerToTurnOffDevice Disabled -ErrorAction SilentlyContinue
    } catch {}
    `);
  }

  const result = await executeElevatedScript(scriptParts.join("\n"));
  return result;
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

  const dnsFormatted = backup.dns && backup.dns.length > 0 ? `@(${backup.dns.map((d) => `'${d}'`).join(",")})` : null;
  const tcpLevel = backup.tcpAutoTuning || "Normal";
  const powerSave = backup.powerAllowTurnOff === "Enabled" ? "Enabled" : "Disabled";

  let scriptParts: string[] = [];

  scriptParts.push(`
  $adapter = Get-NetAdapter | Where-Object {
    $_.InterfaceDescription -match 'Wireless|Wi-Fi|WLAN|802.11' -and $_.Status -ne 'Not Present'
  } | Sort-Object -Property ifIndex | Select-Object -First 1

  if (-not $adapter) {
    throw "Không tìm thấy card mạng WiFi để khôi phục."
  }
  `);

  if (dnsFormatted) {
    scriptParts.push(`Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses ${dnsFormatted}`);
  } else {
    scriptParts.push(`Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ResetServerAddresses`);
  }

  scriptParts.push(`Set-NetTCPSetting -SettingName Internet -AutoTuningLevelLocal ${tcpLevel}`);

  scriptParts.push(`
  try {
    Set-NetAdapterPowerManagement -Name $adapter.Name -AllowComputerToTurnOffDevice ${powerSave} -ErrorAction SilentlyContinue
  } catch {}
  `);

  const result = await executeElevatedScript(scriptParts.join("\n"));
  if (result.success) {
    clearBackupConfig();
  }
  return result;
}
