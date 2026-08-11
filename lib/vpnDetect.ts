import { isWindows, runPowerShell } from "./runPowerShell";
import type { VpnStatus } from "./types";

// Suy đoán VPN đang bật dựa theo TÊN DRIVER của các adapter đang ở trạng
// thái Up — đây là heuristic (dò theo tên phổ biến của driver/phần mềm VPN
// thông dụng), KHÔNG PHẢI phát hiện chính xác 100%: VPN dùng driver đặt tên
// khác thường sẽ không bị phát hiện, và về lý thuyết vẫn có khả năng trùng
// tên với 1 thiết bị khác không phải VPN. Mục đích chỉ để cảnh báo tham
// khảo trước khi đo tốc độ, không phải một khẳng định chắc chắn — tránh
// lặp lại lỗi gắn nhãn phóng đại đã từng sửa trước đây (vụ "Gaming Ping").
const SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$vpnAdapters = Get-NetAdapter | Where-Object {
  $_.Status -eq 'Up' -and $_.InterfaceDescription -match 'VPN|TAP-Windows|Wintun|WireGuard|OpenVPN|AnyConnect|NordLynx|ExpressVPN|Tailscale|ZeroTier'
}
$result = @{ names = @($vpnAdapters | Select-Object -ExpandProperty Name) }
$result | ConvertTo-Json -Compress
`.trim();

export async function getVpnStatus(): Promise<VpnStatus> {
  if (!isWindows()) {
    return { platform: "mock", detected: false, adapterNames: [], fetchedAt: new Date().toISOString() };
  }

  const raw = await runPowerShell(SCRIPT);
  const parsed = JSON.parse(raw.trim() || "{}");
  const names: string[] = Array.isArray(parsed.names) ? parsed.names : parsed.names ? [parsed.names] : [];

  return {
    platform: "win32",
    detected: names.length > 0,
    adapterNames: names,
    fetchedAt: new Date().toISOString(),
  };
}
