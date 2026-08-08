import { connect } from "node:net";
import type { PingResult } from "./types";

// Đo độ trễ bằng bắt tay TCP (không cần ICMP/quyền admin, hoạt động ổn định
// hơn ping.exe khi firewall chặn ICMP). Dùng cổng 53 (DNS) vì đây chủ yếu để
// so sánh độ trễ tới các máy chủ DNS.
const DNS_PORT = 53;
const CONNECT_TIMEOUT_MS = 2500;

const PUBLIC_RESOLVERS = new Set(["1.1.1.1", "8.8.8.8", "9.9.9.9"]);
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

// Route API này nhận host từ client, nên giới hạn chặt để tránh bị lợi dụng
// dò cổng/địa chỉ tuỳ ý (server chỉ chạy trên 127.0.0.1 nhưng vẫn nên phòng
// thủ theo chiều sâu): chỉ chấp nhận 3 DNS công cộng đã biết, hoặc một IPv4
// thuộc dải mạng riêng (LAN) — tức là DNS của router mà getNetworkInfo() trả
// về. Cổng luôn cố định là 53, không cho client chọn cổng.
export function isAllowedPingHost(host: string): boolean {
  if (PUBLIC_RESOLVERS.has(host)) return true;
  const match = host.match(IPV4_RE);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((n) => n > 255)) return false;
  const [a, b] = octets;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function tcpPing(host: string): Promise<number | null> {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = connect({ host, port: DNS_PORT, timeout: CONNECT_TIMEOUT_MS });
    let done = false;
    const finish = (ms: number | null) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ms);
    };
    socket.once("connect", () => finish(performance.now() - start));
    socket.once("timeout", () => finish(null));
    socket.once("error", () => finish(null));
  });
}

export async function pingHost(host: string, samples = 5): Promise<PingResult> {
  const results: PingResult["samples"] = [];
  for (let i = 0; i < samples; i++) {
    const ms = await tcpPing(host);
    results.push({ ok: ms !== null, ms: ms !== null ? Math.round(ms) : null });
  }

  const okSamples = results.filter((r): r is { ok: true; ms: number } => r.ok && r.ms !== null).map((r) => r.ms);
  const avgMs = okSamples.length ? Math.round(okSamples.reduce((a, b) => a + b, 0) / okSamples.length) : null;

  let jitterMs: number | null = null;
  if (okSamples.length > 1) {
    const diffs = okSamples.slice(1).map((v, i) => Math.abs(v - okSamples[i]));
    jitterMs = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
  }

  return {
    host,
    samples: results,
    avgMs,
    jitterMs,
    lossPercent: Math.round(((samples - okSamples.length) / samples) * 100),
  };
}
