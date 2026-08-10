export type DataSource = "win32" | "mock";

export interface AdapterInfo {
  name: string;
  description: string;
  status: string;
  linkSpeed: string;
  macAddress: string;
  driverVersion: string;
  driverDate: string;
  driverProvider: string;
}

export interface TcpSettingInfo {
  autoTuningLevel: string;
  ecnCapability: string;
  scalingHeuristics: string;
}

export interface PowerManagementInfo {
  allowComputerToTurnOffDevice: string | null;
}

export interface NetworkInfo {
  platform: DataSource;
  adapter: AdapterInfo | null;
  tcp: TcpSettingInfo | null;
  dns: string[];
  power: PowerManagementInfo | null;
  fetchedAt: string;
}

export type WifiBand = "2.4GHz" | "5GHz" | "6GHz" | "unknown";

export interface WifiNetwork {
  ssid: string;
  bssid: string;
  signalPercent: number;
  channel: number;
  band: WifiBand;
  authentication: string;
}

export interface WifiScanResult {
  platform: DataSource;
  networks: WifiNetwork[];
  suggestedChannel24: number | null;
  fetchedAt: string;
}

export interface PingSample {
  ok: boolean;
  ms: number | null;
}

export interface PingResult {
  host: string;
  samples: PingSample[];
  avgMs: number | null;
  jitterMs: number | null;
  lossPercent: number;
}

export type DnsPresetKey = "cloudflare" | "google" | "quad9" | "dhcp" | "custom";

export interface BackupConfig {
  createdAt: string;
  dns: string[];
  tcpAutoTuning: string;
  powerAllowTurnOff: string | null;
}

export interface OptimizationSettings {
  dnsPreset: DnsPresetKey;
  customDns?: string[];
  enableTcpTuning: boolean;
  disablePowerSave: boolean;
}

export interface OptimizationStatusResult {
  platform: DataSource;
  isOptimized: boolean;
  dnsStatus: "optimized" | "suboptimal" | "unknown";
  tcpStatus: "optimized" | "suboptimal" | "unknown";
  powerStatus: "optimized" | "suboptimal" | "unknown";
  backup: BackupConfig | null;
}

export type SpeedUnit = "Mbps" | "MB/s" | "Kbps";

export type SpeedServerRegion = "auto" | "vn" | "sg" | "hk" | "jp" | "us";

export interface SpeedServerInfo {
  id: SpeedServerRegion;
  name: string;
  flag: string;
  endpoint: string;
}

export function convertSpeed(bps: number | undefined | null, unit: SpeedUnit): number | null {
  if (bps === undefined || bps === null) return null;
  switch (unit) {
    case "MB/s":
      return Math.round((bps / 8_000_000) * 100) / 100;
    case "Kbps":
      return Math.round(bps / 1_000);
    case "Mbps":
    default:
      return Math.round((bps / 1_000_000) * 10) / 10;
  }
}

export function formatSpeed(bps: number | undefined | null, unit: SpeedUnit): string {
  const converted = convertSpeed(bps, unit);
  if (converted === null) return "—";
  return `${converted} ${unit}`;
}


