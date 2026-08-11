import SpeedTest from "@cloudflare/speedtest";
import { runFallbackSpeedProbe, type LiveProgress } from "./speedProbe";

export type { LiveProgress };

export interface FullSpeedTestResult {
  downloadBps: number;
  uploadBps: number;
  latencyMs: number;
  jitterMs: number;
}

// SDK Cloudflare trả latency/jitter dạng số thực với rất nhiều chữ số thập
// phân (vd. 58.14999999999418) — làm tròn về 1 chữ số thập phân cho dễ đọc,
// khớp quy ước hiển thị ms đã dùng ở các nơi khác trong app (lib/ping.ts).
function roundMs(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.round(value * 10) / 10;
}

// Đo tốc độ toàn diện (download+upload+latency+jitter) bằng SDK chính thức
// của Cloudflare — engine chính vì có tính toán theo percentile và đo packet
// loss, đáng tin hơn nhiều so với vòng lặp fetch tự viết.
function runOfficialSpeedTest(onProgress: (p: LiveProgress) => void): Promise<FullSpeedTestResult> {
  return new Promise((resolve, reject) => {
    const engine = new SpeedTest();

    engine.onResultsChange = () => {
      const s = engine.results.getSummary();
      onProgress({
        phase: s.upload !== undefined ? "upload" : s.download !== undefined ? "download" : "ping",
        downloadBps: s.download,
        uploadBps: s.upload,
        latencyMs: roundMs(s.latency),
        jitterMs: roundMs(s.jitter),
        percent: 50,
      });
    };

    engine.onFinish = (results) => {
      const s = results.getSummary();
      onProgress({
        phase: "done",
        downloadBps: s.download,
        uploadBps: s.upload,
        latencyMs: roundMs(s.latency),
        jitterMs: roundMs(s.jitter),
        percent: 100,
      });
      if (s.download === undefined && s.upload === undefined) {
        reject(new Error("Không đo được tốc độ mạng."));
        return;
      }
      resolve({
        downloadBps: s.download ?? 0,
        uploadBps: s.upload ?? 0,
        latencyMs: roundMs(s.latency) ?? 0,
        jitterMs: roundMs(s.jitter) ?? 0,
      });
    };

    engine.onError = (message) => reject(new Error(message));
  });
}

// Dùng chung cho cả bài đo thủ công (SpeedTestPanel) và bài đo tự động theo
// lịch (ScheduledSpeedTestRunner) — thử engine chính thức trước, chỉ rơi
// xuống phương án dự phòng khi SDK lỗi (ví dụ WebRTC/TURN bị chặn).
export async function runFullSpeedTest(onProgress: (p: LiveProgress) => void): Promise<FullSpeedTestResult> {
  try {
    return await runOfficialSpeedTest(onProgress);
  } catch {
    return await runFallbackSpeedProbe(onProgress);
  }
}
