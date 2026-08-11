import { isWindows, runPowerShell } from "./runPowerShell";
import type { AdvancedNetworkInfo } from "./types";

// Chỉ đọc (Get-*/registry read), không chỉnh sửa gì — an toàn để chạy mà
// không cần quyền admin, giống lib/networkInfo.ts.
const SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$adapter = Get-NetAdapter | Where-Object {
  $_.InterfaceDescription -match 'Wireless|Wi-Fi|WLAN|802.11' -and $_.Status -ne 'Not Present'
} | Sort-Object -Property ifIndex | Select-Object -First 1

$rss = if ($adapter) { Get-NetAdapterRss -Name $adapter.Name -ErrorAction SilentlyContinue } else { $null }
$tcp = Get-NetTCPSetting -SettingName Internet
$doPath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DeliveryOptimization\\Config'
$doMode = if (Test-Path $doPath) { (Get-ItemProperty -Path $doPath -Name DODownloadMode -ErrorAction SilentlyContinue).DODownloadMode } else { $null }
$advProps = if ($adapter) {
  Get-NetAdapterAdvancedProperty -Name $adapter.Name -ErrorAction SilentlyContinue | Select-Object DisplayName, DisplayValue
} else { @() }

$result = [ordered]@{
  rssEnabled = if ($rss) { [bool]$rss.Enabled } else { $null }
  congestionProvider = if ($tcp) { $tcp.CongestionProvider } else { $null }
  doDownloadMode = $doMode
  advancedProperties = @($advProps)
}
$result | ConvertTo-Json -Depth 5 -Compress
`.trim();

export async function getAdvancedNetworkInfo(): Promise<AdvancedNetworkInfo> {
  if (!isWindows()) {
    return {
      platform: "mock",
      rssEnabled: true,
      congestionProvider: "CTCP",
      deliveryOptimizationDownloadMode: 0,
      advancedProperties: [
        { displayName: "Speed & Duplex", displayValue: "Auto Negotiation" },
        { displayName: "Roaming Aggressiveness", displayValue: "3. Medium" },
        { displayName: "Preferred Band", displayValue: "2. Prefer 5GHz Band" },
      ],
      fetchedAt: new Date().toISOString(),
    };
  }

  const raw = await runPowerShell(SCRIPT);
  const parsed = JSON.parse(raw.trim() || "{}");
  const rawProps = Array.isArray(parsed.advancedProperties)
    ? parsed.advancedProperties
    : parsed.advancedProperties
    ? [parsed.advancedProperties]
    : [];

  return {
    platform: "win32",
    rssEnabled: typeof parsed.rssEnabled === "boolean" ? parsed.rssEnabled : null,
    congestionProvider: parsed.congestionProvider ?? null,
    deliveryOptimizationDownloadMode: typeof parsed.doDownloadMode === "number" ? parsed.doDownloadMode : null,
    advancedProperties: rawProps.map((p: any) => ({
      displayName: String(p.DisplayName ?? ""),
      displayValue: String(p.DisplayValue ?? ""),
    })),
    fetchedAt: new Date().toISOString(),
  };
}
