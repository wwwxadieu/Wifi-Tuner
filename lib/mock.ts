import { suggestChannel24 } from "./wifiChannel";
import type { NetworkInfo, WifiNetwork, WifiScanResult } from "./types";

// Dữ liệu mẫu dùng khi chạy ngoài Windows (ví dụ môi trường phát triển trên
// Linux/macOS) để giao diện vẫn hiển thị và test được — không dùng lệnh
// PowerShell/netsh thật trên các nền tảng này.
export function mockNetworkInfo(): NetworkInfo {
  return {
    platform: "mock",
    adapter: {
      name: "Wi-Fi",
      description: "Intel(R) Wi-Fi 6 AX201 160MHz (dữ liệu mẫu)",
      status: "Up",
      linkSpeed: "866 Mbps",
      macAddress: "AA-BB-CC-DD-EE-FF",
      driverVersion: "22.190.0.7",
      driverDate: "2024-11-12",
      driverProvider: "Intel Corporation",
    },
    tcp: {
      autoTuningLevel: "Normal",
      ecnCapability: "Disabled",
      scalingHeuristics: "Disabled",
    },
    dns: ["192.168.1.1"],
    power: { allowComputerToTurnOffDevice: "Enabled" },
    fetchedAt: new Date().toISOString(),
  };
}

export function mockWifiScan(): WifiScanResult {
  const networks: WifiNetwork[] = [
    { ssid: "Nha-Minh_5G", bssid: "AA:11:22:33:44:55", signalPercent: 92, channel: 44, band: "5GHz", authentication: "WPA2-Personal" },
    { ssid: "Nha-Minh", bssid: "AA:11:22:33:44:56", signalPercent: 88, channel: 6, band: "2.4GHz", authentication: "WPA2-Personal" },
    { ssid: "TP-LINK_HangXom", bssid: "BB:22:33:44:55:66", signalPercent: 54, channel: 6, band: "2.4GHz", authentication: "WPA2-Personal" },
    { ssid: "Xiaomi_2.4G", bssid: "CC:33:44:55:66:77", signalPercent: 41, channel: 11, band: "2.4GHz", authentication: "WPA2-Personal" },
    { ssid: "FPT_Camera", bssid: "DD:44:55:66:77:88", signalPercent: 30, channel: 1, band: "2.4GHz", authentication: "Open" },
    { ssid: "Vietel_Wifi", bssid: "EE:55:66:77:88:99", signalPercent: 24, channel: 6, band: "2.4GHz", authentication: "WPA2-Personal" },
  ];
  return {
    platform: "mock",
    networks: networks.sort((a, b) => b.signalPercent - a.signalPercent),
    suggestedChannel24: suggestChannel24(networks),
    fetchedAt: new Date().toISOString(),
  };
}
