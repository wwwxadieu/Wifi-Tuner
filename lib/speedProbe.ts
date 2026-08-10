export interface LiveProgress {
  phase: "ping" | "download" | "upload" | "done";
  downloadBps?: number;
  uploadBps?: number;
  latencyMs?: number;
  jitterMs?: number;
  percent: number;
}

// Phương án dự phòng khi SDK chính thức @cloudflare/speedtest gặp lỗi (ví dụ bị
// chặn WebRTC/TURN dùng để đo packet loss). Đo bằng fetch thuần tới endpoint
// công khai của Cloudflare — kém chính xác hơn SDK (không có percentile, không
// đo packet loss) nhưng vẫn đủ dùng làm dự phòng.
//
// Quan trọng: khi một phép đo lỗi (mất mạng, endpoint không phản hồi...), các
// hàm dưới đây NÉM LỖI thật ra ngoài thay vì trả về một con số giả trông hợp lý
// — nếu không, người dùng mất mạng hoàn toàn vẫn thấy "55 Mbps" và tin rằng
// mạng đang ổn, phản tác dụng với mục đích chẩn đoán của app.

export async function measurePing(): Promise<{ latencyMs: number; jitterMs: number }> {
  const pings: number[] = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await fetch("https://1.1.1.1/cdn-cgi/trace", { cache: "no-store", mode: "cors" });
    pings.push(performance.now() - start);
  }
  const avg = Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
  const jit = Math.round(Math.abs(pings[pings.length - 1] - pings[0]) / pings.length);
  return { latencyMs: avg, jitterMs: jit };
}

// 6-second Detailed Download Test
export async function runDetailedDownloadTest(
  onProgress: (prog: LiveProgress) => void
): Promise<{ downloadBps: number; latencyMs: number; jitterMs: number }> {
  onProgress({ phase: "ping", percent: 10 });
  const { latencyMs, jitterMs } = await measurePing();

  onProgress({ phase: "download", latencyMs, jitterMs, percent: 25 });

  let downloadBps = 0;
  const testUrl = `https://speed.cloudflare.com/__down?bytes=25000000&t=${Date.now()}`;
  const startTime = performance.now();
  const response = await fetch(testUrl, { cache: "no-store" });
  if (!response.body) {
    throw new Error("Không nhận được dữ liệu từ máy chủ đo tốc độ.");
  }

  const reader = response.body.getReader();
  let receivedBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    const currentElapsed = (performance.now() - startTime) / 1000;
    if (currentElapsed > 0.05) {
      const currentBps = (receivedBytes * 8) / currentElapsed;
      downloadBps = currentBps;
      const prog = Math.min(95, 25 + Math.round((currentElapsed / 5.5) * 70));
      onProgress({ phase: "download", downloadBps: currentBps, latencyMs, jitterMs, percent: prog });
    }
  }

  onProgress({ phase: "done", downloadBps, latencyMs, jitterMs, percent: 100 });
  return { downloadBps, latencyMs, jitterMs };
}

// 6-second Detailed Upload Test
export async function runDetailedUploadTest(
  onProgress: (prog: LiveProgress) => void
): Promise<{ uploadBps: number; latencyMs: number; jitterMs: number }> {
  onProgress({ phase: "ping", percent: 10 });
  const { latencyMs, jitterMs } = await measurePing();

  onProgress({ phase: "upload", latencyMs, jitterMs, percent: 25 });

  let uploadBps = 0;
  const uploadData = new Uint8Array(4 * 1024 * 1024); // 4MB payload
  const startUpload = performance.now();

  // Stream 3 consecutive chunks to measure steady upload speed
  for (let chunk = 1; chunk <= 3; chunk++) {
    await fetch("https://speed.cloudflare.com/__up", {
      method: "POST",
      body: uploadData,
      mode: "cors",
    });
    const elapsed = (performance.now() - startUpload) / 1000;
    if (elapsed > 0) {
      uploadBps = (uploadData.byteLength * chunk * 8) / elapsed;
      const prog = Math.min(95, 25 + Math.round((chunk / 3) * 70));
      onProgress({ phase: "upload", uploadBps, latencyMs, jitterMs, percent: prog });
    }
  }

  onProgress({ phase: "done", uploadBps, latencyMs, jitterMs, percent: 100 });
  return { uploadBps, latencyMs, jitterMs };
}

// Combined Full Test (fallback path only — xem ghi chú ở đầu file)
export async function runFallbackSpeedProbe(
  onProgress: (prog: LiveProgress) => void
): Promise<{ downloadBps: number; uploadBps: number; latencyMs: number; jitterMs: number }> {
  const dlRes = await runDetailedDownloadTest((p) => {
    onProgress({ ...p, percent: Math.round(p.percent * 0.5) });
  });

  const ulRes = await runDetailedUploadTest((p) => {
    onProgress({ ...p, downloadBps: dlRes.downloadBps, percent: 50 + Math.round(p.percent * 0.5) });
  });

  return {
    downloadBps: dlRes.downloadBps,
    uploadBps: ulRes.uploadBps,
    latencyMs: dlRes.latencyMs,
    jitterMs: dlRes.jitterMs,
  };
}
