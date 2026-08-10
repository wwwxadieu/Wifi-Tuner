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

export interface KnownDnsProvider {
  id: string;
  name: string;
  provider: string;
  primary: string;
  secondary: string;
}

// Nguồn dữ liệu DUY NHẤT cho danh sách DNS công cộng cố định mà app biết tới.
// Dùng chung bởi lib/ping.ts (allowlist host được phép đo — chỉ nhận IP cố định,
// không nhận input tự do) và các panel client (DNS Benchmark, so sánh ping DNS)
// để 2 bên không bị lệch nhau như trước (panel liệt kê IP mà allowlist không có).
export const KNOWN_DNS_PROVIDERS: KnownDnsProvider[] = [
  { id: "cloudflare", name: "Cloudflare DNS", provider: "Cloudflare", primary: "1.1.1.1", secondary: "1.0.0.1" },
  { id: "google", name: "Google Public DNS", provider: "Google", primary: "8.8.8.8", secondary: "8.8.4.4" },
  { id: "quad9", name: "Quad9 Security", provider: "Quad9", primary: "9.9.9.9", secondary: "149.112.112.112" },
  { id: "opendns", name: "OpenDNS Home", provider: "Cisco", primary: "208.67.222.222", secondary: "208.67.220.220" },
  { id: "adguard", name: "AdGuard DNS (Chặn QC)", provider: "AdGuard", primary: "94.140.14.14", secondary: "94.140.15.15" },
  { id: "viettel", name: "Viettel DNS", provider: "Viettel ISP", primary: "203.119.9.9", secondary: "203.119.9.10" },
  { id: "vnpt", name: "VNPT DNS", provider: "VNPT ISP", primary: "203.162.4.190", secondary: "203.162.4.191" },
  { id: "fpt", name: "FPT Telecom DNS", provider: "FPT Telecom", primary: "210.245.24.20", secondary: "210.245.24.22" },
];

export function knownDnsIps(): string[] {
  return KNOWN_DNS_PROVIDERS.flatMap((d) => [d.primary, d.secondary]);
}

