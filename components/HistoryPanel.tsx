"use client";

import { useEffect, useState } from "react";
import type { SpeedHistoryRecord, SpeedStats } from "@/lib/db";
import type { DriverAnalysisResult } from "@/lib/driverCheck";
import StatCard from "./StatCard";

export default function HistoryPanel() {
  const [history, setHistory] = useState<SpeedHistoryRecord[]>([]);
  const [stats, setStats] = useState<SpeedStats | null>(null);
  const [driver, setDriver] = useState<DriverAnalysisResult | null>(null);
  const [schedule, setSchedule] = useState<string>("off");
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [histRes, schedRes] = await Promise.all([
        fetch("/api/history"),
        fetch("/api/schedule"),
      ]);

      if (histRes.ok) {
        const data = await histRes.json();
        setHistory(data.history || []);
        setStats(data.stats || null);
        setDriver(data.driver || null);
      }

      if (schedRes.ok) {
        const schedData = await schedRes.json();
        setSchedule(schedData.interval || "off");
      }
    } catch {
      setMsg("Không thể kết nối đến API lịch sử");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleScheduleChange = async (newInterval: string) => {
    setSchedule(newInterval);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval: newInterval }),
      });
      if (res.ok) {
        setMsg("Đã lưu lịch tự động đo thành công!");
        setTimeout(() => setMsg(null), 3000);
      }
    } catch {
      setMsg("Lỗi khi lưu cài đặt lịch đo.");
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử speed test đã lưu?")) return;
    setClearing(true);
    try {
      const res = await fetch("/api/history", { method: "DELETE" });
      if (res.ok) {
        setHistory([]);
        setStats(null);
        setMsg("Đã xóa lịch sử đo.");
        setTimeout(() => setMsg(null), 3000);
      }
    } catch {
      setMsg("Lỗi khi xóa lịch sử.");
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-white/50 animate-pulse">Đang tải lịch sử & phân tích Driver…</div>;
  }

  // Find max download speed to calculate progress bar widths
  const maxDownload = history.length > 0
    ? Math.max(...history.map((h) => h.downloadMbps || 0), 10)
    : 100;

  return (
    <div className="space-y-8 animate-fade-up">
      {msg && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">
          {msg}
        </div>
      )}

      {/* Driver Health Card */}
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-panel via-panel to-slate-900/60 p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">Chẩn đoán Driver Card WiFi</h2>
              {driver?.status === "outdated" && (
                <span className="rounded-full border border-rose-500/40 bg-rose-500/20 px-3 py-0.5 text-xs font-semibold text-rose-400">
                  ⚠️ Driver quá cũ
                </span>
              )}
              {driver?.status === "up_to_date" && (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-0.5 text-xs font-semibold text-emerald-400">
                  ✓ Driver mới
                </span>
              )}
              {driver?.status === "moderate" && (
                <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-3 py-0.5 text-xs font-semibold text-amber-400">
                  ℹ️ Ổn định
                </span>
              )}
            </div>
            <p className="text-sm text-white/60">
              {driver?.adapter ? `${driver.adapter.name} (${driver.adapter.driverProvider})` : "Card WiFi Windows"}
            </p>
          </div>

          {driver?.vendorUrl && (
            <a
              href={driver.vendorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10 active:scale-95"
            >
              🌐 Kiểm tra Driver tại {driver.vendorName} ↗
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 pt-2">
          <StatCard label="Phiên bản Driver" value={driver?.adapter?.driverVersion || "—"} />
          <StatCard label="Ngày phát hành" value={driver?.adapter?.driverDate || "—"} />
          <StatCard label="Tuổi Driver" value={driver?.driverAgeYears != null ? `${driver.driverAgeYears} năm` : "—"} />
          <StatCard label="Đánh giá" value={driver?.statusText || "—"} highlight={driver?.status === "outdated" ? "bad" : "good"} />
        </div>

        <div className="rounded-xl border border-hair bg-black/20 p-4 text-xs text-white/70">
          💡 <span className="font-semibold text-white/90">Khuyến nghị:</span> {driver?.recommendation}
        </div>
      </section>

      {/* Auto Speed Test Schedule Config */}
      <section className="rounded-2xl border border-hair bg-panel p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Lên lịch đo tốc độ tự động</h3>
            <p className="text-xs text-white/50">Tự động thực hiện đo tốc độ định kỳ để theo dõi biến động đường truyền.</p>
          </div>

          <div className="flex items-center gap-2 bg-black/30 p-1.5 rounded-xl border border-hair">
            {[
              { id: "off", label: "Tắt" },
              { id: "1h", label: "Mỗi 1 giờ" },
              { id: "6h", label: "Mỗi 6 giờ" },
              { id: "12h", label: "Mỗi 12 giờ" },
              { id: "24h", label: "Hàng ngày" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleScheduleChange(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  schedule === opt.id
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Speed Test Statistics */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Thống kê tổng quan</h3>
          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              disabled={clearing}
              className="text-xs text-rose-400 hover:underline"
            >
              Xóa lịch sử đo
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Tổng số lần đo" value={stats?.totalTests ? String(stats.totalTests) : "0"} />
          <StatCard label="Download trung bình" value={stats?.avgDownload ? `${stats.avgDownload} Mbps` : "—"} highlight="accent" />
          <StatCard label="Upload trung bình" value={stats?.avgUpload ? `${stats.avgUpload} Mbps` : "—"} highlight="accent2" />
          <StatCard label="Ping tốt nhất" value={stats?.bestLatency ? `${stats.bestLatency} ms` : "—"} />
        </div>
      </section>

      {/* History Timeline */}
      <section className="rounded-2xl border border-hair bg-panel p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">Dòng thời gian kết quả đo (SQLite)</h3>

        {history.length === 0 ? (
          <p className="text-sm text-white/40 py-4 text-center">Chưa có dữ liệu lịch sử đo tốc độ. Hãy thử đo ở tab "Tốc độ".</p>
        ) : (
          <div className="space-y-3">
            {history.map((record) => {
              const dlPercent = record.downloadMbps ? Math.min(100, Math.round((record.downloadMbps / maxDownload) * 100)) : 0;
              return (
                <div
                  key={record.id || record.createdAt}
                  className="rounded-xl border border-hair bg-white/[0.02] p-4 space-y-2 hover:bg-white/5 transition"
                >
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span className="font-mono text-white/80">
                      {new Date(record.createdAt).toLocaleString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase font-semibold text-white/70">
                      {record.source === "scheduled" ? "Tự động" : "Thủ công"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm font-semibold">
                    <div className="text-cyan-400">↓ {record.downloadMbps !== null ? `${record.downloadMbps} Mbps` : "—"}</div>
                    <div className="text-indigo-400">↑ {record.uploadMbps !== null ? `${record.uploadMbps} Mbps` : "—"}</div>
                    <div className="text-white/80">Ping: {record.latencyMs !== null ? `${record.latencyMs} ms` : "—"}</div>
                    <div className="text-white/50">Jitter: {record.jitterMs !== null ? `${record.jitterMs} ms` : "—"}</div>
                  </div>

                  {/* Progress bar visual */}
                  <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${dlPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
