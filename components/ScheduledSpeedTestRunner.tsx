"use client";

import { useEffect, useRef } from "react";
import { runFullSpeedTest } from "@/lib/speedTestEngine";

const POLL_MS = 60_000;
// Bảo vệ chống treo vĩnh viễn: nếu engine đo (SDK Cloudflare hoặc phương án
// dự phòng) không bao giờ resolve/reject khi mạng có sự cố bất thường,
// không có timeout thì runningRef sẽ kẹt "true" mãi mãi — chặn luôn mọi lần
// đo tự động/thủ công sau đó cho tới khi khởi động lại app.
const MEASUREMENT_TIMEOUT_MS = 45_000;
const INTERVAL_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

// Cảnh báo khi tốc độ download đo được giảm quá tỉ lệ này so với trung bình
// các lần đo trước — dấu hiệu đường truyền đang có vấn đề bất thường.
const DROP_ALERT_RATIO = 0.7;

function notify(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  const show = () => new Notification(title, { body });
  if (Notification.permission === "granted") {
    show();
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") show();
    });
  }
}

// Component không render UI — chạy nền, đọc cấu hình lịch đo (/api/schedule)
// mỗi 60s, tự thực hiện đo tốc độ khi tới hạn, lưu kết quả với
// source: "scheduled", rồi cảnh báo qua Notification nếu tốc độ tụt mạnh.
// Chỉ có ý nghĩa thực tế khi cửa sổ chính còn "sống" (ẩn xuống khay thay vì
// bị đóng hẳn — xem electron/main.js).
export default function ScheduledSpeedTestRunner() {
  const runningRef = useRef(false);

  useEffect(() => {
    // source: "scheduled" khi tự động tới hạn, "manual" khi bấm "Đo tốc độ
    // ngay" từ menu khay hệ thống (electron/main.js) — chỉ khác nhãn lưu vào
    // lịch sử, luồng đo + cảnh báo tụt tốc độ giống hệt nhau.
    const runOnce = async (source: "scheduled" | "manual") => {
      if (runningRef.current) return;
      runningRef.current = true;

      try {
        let avgDownloadBaseline: number | null = null;
        try {
          const histRes = await fetch("/api/history");
          if (histRes.ok) {
            const histData = await histRes.json();
            avgDownloadBaseline = histData.stats?.avgDownload ?? null;
          }
        } catch {
          // best-effort — không có baseline thì bỏ qua bước cảnh báo tụt tốc độ
        }

        const result = await Promise.race([
          runFullSpeedTest(() => {}),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Đo tốc độ quá thời gian chờ")), MEASUREMENT_TIMEOUT_MS)
          ),
        ]);
        const downloadMbps = Math.round((result.downloadBps / 1_000_000) * 10) / 10;
        const uploadMbps = Math.round((result.uploadBps / 1_000_000) * 10) / 10;

        await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            downloadMbps,
            uploadMbps,
            latencyMs: result.latencyMs,
            jitterMs: result.jitterMs,
            source,
          }),
        }).catch(() => {});

        if (avgDownloadBaseline && downloadMbps < avgDownloadBaseline * DROP_ALERT_RATIO) {
          notify(
            "WiFi Tuner: Tốc độ mạng giảm bất thường",
            `Download hiện tại ${downloadMbps} Mbps, thấp hơn nhiều so với trung bình ${avgDownloadBaseline} Mbps.`
          );
        } else if (source === "manual") {
          notify("WiFi Tuner: Đã đo xong", `Download ${downloadMbps} Mbps · Upload ${uploadMbps} Mbps.`);
        }
      } catch {
        // Lỗi đo (mất mạng tạm thời...) — bỏ qua, không chặn lần đo tiếp theo.
      } finally {
        if (source === "scheduled") {
          await fetch("/api/schedule", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markRun: true }),
          }).catch(() => {});
        }
        runningRef.current = false;
      }
    };

    const checkAndRun = async () => {
      if (runningRef.current) return;

      let interval = "off";
      let lastRun = "";
      try {
        const res = await fetch("/api/schedule");
        if (!res.ok) return;
        const data = await res.json();
        interval = data.interval || "off";
        lastRun = data.lastRun || "";
      } catch {
        return;
      }

      const intervalMs = INTERVAL_MS[interval];
      if (!intervalMs) return;

      const lastRunTime = lastRun ? new Date(lastRun).getTime() : 0;
      const dueTime = lastRunTime + intervalMs;
      if (Date.now() < dueTime) return;

      await runOnce("scheduled");
    };

    checkAndRun();
    const timer = setInterval(checkAndRun, POLL_MS);

    const offTray = window.wifituner?.onTrayRunSpeedTest?.(() => {
      runOnce("manual");
    });

    return () => {
      clearInterval(timer);
      offTray?.();
    };
  }, []);

  return null;
}
