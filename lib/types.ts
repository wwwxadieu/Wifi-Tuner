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
