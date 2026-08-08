import type { WifiBand, WifiNetwork } from "./types";

const NON_OVERLAPPING_24 = [1, 6, 11];

export function bandForChannel(channel: number): WifiBand {
  if (channel >= 1 && channel <= 14) return "2.4GHz";
  if (channel >= 32 && channel <= 177) return "5GHz";
  if (channel > 177) return "6GHz";
  return "unknown";
}

// Gợi ý kênh 2.4GHz ít bị các mạng lân cận chiếm dụng nhất, dựa trên 3 kênh
// không chồng lấn sóng (1/6/11). Chỉ mang tính tham khảo — người dùng cần tự
// đổi kênh này trong trang quản trị router, app không thể đổi hộ.
export function suggestChannel24(networks: WifiNetwork[]): number | null {
  const counts = new Map<number, number>(NON_OVERLAPPING_24.map((ch) => [ch, 0]));

  for (const net of networks) {
    if (net.band !== "2.4GHz") continue;
    const nearest = NON_OVERLAPPING_24.reduce((a, b) =>
      Math.abs(b - net.channel) < Math.abs(a - net.channel) ? b : a
    );
    counts.set(nearest, (counts.get(nearest) ?? 0) + 1);
  }

  let best: number | null = null;
  let bestCount = Infinity;
  for (const ch of NON_OVERLAPPING_24) {
    const count = counts.get(ch) ?? 0;
    if (count < bestCount) {
      bestCount = count;
      best = ch;
    }
  }
  return best;
}
