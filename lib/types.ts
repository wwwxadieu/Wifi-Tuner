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

// Các trường "advanced*" là tuỳ chọn (optional) để tương thích ngược với các
// bản backup cũ được tạo trước khi có tính năng tinh chỉnh nâng cao — khi
// đọc backup cũ thiếu trường này, logic khôi phục sẽ bỏ qua (không đổi)
// thay vì áp giá trị sai.
export interface BackupConfig {
  createdAt: string;
  dns: string[];
  tcpAutoTuning: string;
  powerAllowTurnOff: string | null;
  rssEnabled?: boolean | null;
  congestionProvider?: string | null;
  deliveryOptimizationDownloadMode?: number | null;
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

// Thuật toán kiểm soát nghẽn mạng TCP mà Windows hỗ trợ qua
// Set-NetTCPSetting -CongestionProvider. CTCP (Compound TCP) tận dụng băng
// thông tốt hơn NewReno/Default trên đường truyền băng thông cao, độ trễ lớn
// (điển hình của WiFi/cáp quang) — đây là lựa chọn khuyến nghị của app.
export type CongestionProviderKey = "Default" | "CTCP" | "NewReno" | "DCTCP";

export interface AdvancedAdapterProperty {
  displayName: string;
  displayValue: string;
}

export interface AdvancedNetworkInfo {
  platform: DataSource;
  rssEnabled: boolean | null;
  congestionProvider: string | null;
  // Registry DODownloadMode của Windows Delivery Optimization: 0/99 = chỉ
  // tải qua HTTP (tắt chia sẻ P2P), 1 = chỉ P2P trong LAN, 3 = P2P cả LAN
  // lẫn Internet (mặc định, tốn băng thông upload nhiều nhất).
  deliveryOptimizationDownloadMode: number | null;
  advancedProperties: AdvancedAdapterProperty[];
  fetchedAt: string;
}

export interface AdvancedOptimizationSettings {
  enableRss: boolean;
  congestionProvider: CongestionProviderKey;
  disableDeliveryOptimizationP2P: boolean;
}

export interface AdvancedOptimizationStatusResult {
  platform: DataSource;
  isOptimized: boolean;
  rssStatus: "optimized" | "suboptimal" | "unknown";
  congestionStatus: "optimized" | "suboptimal" | "unknown";
  doStatus: "optimized" | "suboptimal" | "unknown";
  backup: BackupConfig | null;
  advancedProperties: AdvancedAdapterProperty[];
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

