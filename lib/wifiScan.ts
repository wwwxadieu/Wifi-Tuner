import { isWindows, runPowerShell } from "./runPowerShell";
import { mockWifiScan } from "./mock";
import { bandForChannel, suggestChannel24 } from "./wifiChannel";
import type { WifiNetwork, WifiScanResult } from "./types";

// Ép UTF-8 cho output của netsh để không bị lỗi font với SSID tiếng Việt.
const SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
netsh wlan show networks mode=bssid
`.trim();

// netsh dịch nhãn theo ngôn ngữ hiển thị của Windows. Ở đây hỗ trợ tiếng Anh
// và tiếng Việt (2 locale phổ biến nhất với người dùng mục tiêu). Nếu Windows
// dùng ngôn ngữ khác, phần quét kênh/tín hiệu có thể không đọc được — cần bổ
// sung thêm locale hoặc chuyển sang Native Wifi API ở giai đoạn sau.
const RE_SIGNAL = /(?:Signal|T[íi]n hi[ệe]u)\s*:\s*(\d+)\s*%/i;
const RE_CHANNEL = /(?:Channel|K[êe]nh)\s*:\s*(\d+)/i;
const RE_AUTH = /(?:Authentication|X[áa]c th[ựu]c)\s*:\s*(.+)/i;
const RE_SSID = /^SSID\s+\d+\s*:\s*(.*)$/m;
const RE_BSSID = /BSSID\s+\d+\s*:\s*([0-9a-fA-F:]+)/;

function parseNetshOutput(raw: string): WifiNetwork[] {
  const networks: WifiNetwork[] = [];
  // Mỗi khối SSID bắt đầu bằng dòng "SSID n : ..."
  const ssidBlocks = raw.split(/\r?\n(?=SSID\s+\d+\s*:)/g).filter((b) => RE_SSID.test(b));

  for (const block of ssidBlocks) {
    const ssidMatch = block.match(RE_SSID);
    const ssid = ssidMatch?.[1]?.trim() || "(ẩn)";
    const authMatch = block.match(RE_AUTH);
    // Mỗi SSID có thể có nhiều BSSID (nhiều điểm phát), tách theo dòng "BSSID n :"
    const bssidBlocks = block.split(/\r?\n(?=\s*BSSID\s+\d+\s*:)/g).slice(1);

    for (const bssidBlock of bssidBlocks) {
      const bssidMatch = bssidBlock.match(RE_BSSID);
      const signalMatch = bssidBlock.match(RE_SIGNAL);
      const channelMatch = bssidBlock.match(RE_CHANNEL);
      if (!bssidMatch || !signalMatch || !channelMatch) continue;

      const channel = parseInt(channelMatch[1], 10);
      networks.push({
        ssid,
        bssid: bssidMatch[1],
        signalPercent: parseInt(signalMatch[1], 10),
        channel,
        band: bandForChannel(channel),
        authentication: authMatch?.[1]?.trim() ?? "unknown",
      });
    }
  }

  return networks.sort((a, b) => b.signalPercent - a.signalPercent);
}

export async function getWifiScan(): Promise<WifiScanResult> {
  if (!isWindows()) return mockWifiScan();

  const raw = await runPowerShell(SCRIPT, 15000);
  if (/no wireless interface|kh[ôo]ng c[óo] giao di[ệe]n kh[ôo]ng d[âa]y/i.test(raw)) {
    return { platform: "win32", networks: [], suggestedChannel24: null, fetchedAt: new Date().toISOString() };
  }

  const networks = parseNetshOutput(raw);
  return {
    platform: "win32",
    networks,
    suggestedChannel24: suggestChannel24(networks),
    fetchedAt: new Date().toISOString(),
  };
}
