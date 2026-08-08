import { isWindows, runPowerShell } from "./runPowerShell";
import { mockNetworkInfo } from "./mock";
import type { NetworkInfo } from "./types";

// Chỉ đọc (Get-*), không chỉnh sửa gì — an toàn để chạy mà không cần quyền admin.
const SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$adapter = Get-NetAdapter | Where-Object {
  $_.InterfaceDescription -match 'Wireless|Wi-Fi|WLAN|802.11' -and $_.Status -ne 'Not Present'
} | Sort-Object -Property ifIndex | Select-Object -First 1

$tcp = Get-NetTCPSetting -SettingName Internet
$dns = if ($adapter) { Get-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 } else { $null }
$power = if ($adapter) { Get-NetAdapterPowerManagement -Name $adapter.Name } else { $null }

$result = [ordered]@{
  adapter = if ($adapter) {
    $adapter | Select-Object Name, InterfaceDescription, Status, MacAddress, DriverVersion, DriverProvider,
      @{n='LinkSpeed'; e={ $_.LinkSpeed.ToString() }},
      @{n='DriverDate'; e={ $_.DriverDate.ToString('yyyy-MM-dd') }}
  } else { $null }
  tcp = if ($tcp) { $tcp | Select-Object AutoTuningLevelLocal, EcnCapability, ScalingHeuristics } else { $null }
  dns = if ($dns) { @($dns.ServerAddresses) } else { @() }
  power = if ($power) { $power | Select-Object AllowComputerToTurnOffDevice } else { $null }
}
$result | ConvertTo-Json -Depth 5 -Compress
`.trim();

export async function getNetworkInfo(): Promise<NetworkInfo> {
  if (!isWindows()) return mockNetworkInfo();

  const raw = await runPowerShell(SCRIPT);
  const parsed = JSON.parse(raw.trim() || "{}");

  return {
    platform: "win32",
    adapter: parsed.adapter
      ? {
          name: parsed.adapter.Name ?? "",
          description: parsed.adapter.InterfaceDescription ?? "",
          status: parsed.adapter.Status ?? "",
          linkSpeed: parsed.adapter.LinkSpeed ?? "",
          macAddress: parsed.adapter.MacAddress ?? "",
          driverVersion: parsed.adapter.DriverVersion ?? "",
          driverDate: parsed.adapter.DriverDate ?? "",
          driverProvider: parsed.adapter.DriverProvider ?? "",
        }
      : null,
    tcp: parsed.tcp
      ? {
          autoTuningLevel: String(parsed.tcp.AutoTuningLevelLocal ?? ""),
          ecnCapability: String(parsed.tcp.EcnCapability ?? ""),
          scalingHeuristics: String(parsed.tcp.ScalingHeuristics ?? ""),
        }
      : null,
    dns: Array.isArray(parsed.dns) ? parsed.dns : parsed.dns ? [parsed.dns] : [],
    power: parsed.power
      ? { allowComputerToTurnOffDevice: parsed.power.AllowComputerToTurnOffDevice ?? null }
      : null,
    fetchedAt: new Date().toISOString(),
  };
}
