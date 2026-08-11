"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, CheckCircle2, Info, ExternalLink, Trash2, Calendar, Clock, ArrowDown, ArrowUp, Cpu, History, Power, FileDown } from "lucide-react";
import type { SpeedHistoryRecord, SpeedStats } from "@/lib/db";
import type { DriverAnalysisResult } from "@/lib/driverCheck";
import type { NetworkInfo, OptimizationStatusResult, AdvancedOptimizationStatusResult } from "@/lib/types";
import StatCard from "./StatCard";
import HistoryTrendChart from "./HistoryTrendChart";

const STATUS_LABEL: Record<string, string> = {
  optimized: "Đã tối ưu",
  suboptimal: "Chưa tối ưu",
  unknown: "Không xác định",
};

function line(label: string, value: string): string {
  return `${label.padEnd(28, " ")}: ${value}`;
}

export default function HistoryPanel() {
  const [history, setHistory] = useState<SpeedHistoryRecord[]>([]);
  const [stats, setStats] = useState<SpeedStats | null>(null);
  const [driver, setDriver] = useState<DriverAnalysisResult | null>(null);
  const [schedule, setSchedule] = useState<string>("off");
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Chỉ tồn tại khi chạy trong Electron (điều khiển qua electron/main.js) —
  // ẩn hẳn toggle này khi chạy bằng trình duyệt thường (dev trên Linux/macOS).
  const [autoLaunchSupported, setAutoLaunchSupported] = useState(false);
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [autoLaunchBusy, setAutoLaunchBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

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

    if (typeof window !== "undefined" && window.wifituner?.getAutoLaunchStatus) {
      setAutoLaunchSupported(true);
      window.wifituner
        .getAutoLaunchStatus()
        .then(setAutoLaunch)
        .catch(() => {});
    }
  }, []);

  const handleToggleAutoLaunch = async () => {
    if (!window.wifituner?.toggleAutoLaunch) return;
    setAutoLaunchBusy(true);
    try {
      const next = await window.wifituner.toggleAutoLaunch(!autoLaunch);
      setAutoLaunch(next);
    } finally {
      setAutoLaunchBusy(false);
    }
  };

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

  // Gộp dữ liệu từ các API chẩn đoán đã có (không gọi PowerShell trực tiếp,
  // chỉ đọc lại các route sẵn có) thành 1 báo cáo text — dùng để lưu lại
  // hoặc gửi cho người hỗ trợ kỹ thuật/ISP khi cần đối chiếu.
  const handleExportReport = async () => {
    setExporting(true);
    try {
      const [netRes, optRes, advRes] = await Promise.all([
        fetch("/api/network-info").then((r) => (r.ok ? r.json() : null)) as Promise<NetworkInfo | null>,
        fetch("/api/optimize").then((r) => (r.ok ? r.json() : null)) as Promise<OptimizationStatusResult | null>,
        fetch("/api/advanced-optimize").then((r) => (r.ok ? r.json() : null)) as Promise<AdvancedOptimizationStatusResult | null>,
      ]);

      const now = new Date();
      const lines: string[] = [];
      lines.push("=".repeat(56));
      lines.push("BÁO CÁO CHẨN ĐOÁN WIFI TUNER");
      lines.push(`Xuất lúc: ${now.toLocaleString("vi-VN")}`);
      lines.push("=".repeat(56));

      lines.push("");
      lines.push("-- CARD MẠNG WIFI --");
      if (netRes?.adapter) {
        lines.push(line("Tên adapter", netRes.adapter.name || "—"));
        lines.push(line("Trạng thái", netRes.adapter.status || "—"));
        lines.push(line("Tốc độ liên kết", netRes.adapter.linkSpeed || "—"));
        lines.push(line("Driver", `${netRes.adapter.driverVersion || "—"} (${netRes.adapter.driverDate || "—"})`));
        lines.push(line("Hãng driver", netRes.adapter.driverProvider || "—"));
      } else {
        lines.push("Không đọc được thông tin adapter.");
      }
      lines.push(line("DNS hiện tại", netRes?.dns?.length ? netRes.dns.join(", ") : "—"));

      lines.push("");
      lines.push("-- TỐI ƯU CƠ BẢN --");
      lines.push(line("Tổng trạng thái", optRes?.isOptimized ? "Đã tối ưu" : "Chưa tối ưu đầy đủ"));
      lines.push(line("DNS", STATUS_LABEL[optRes?.dnsStatus ?? "unknown"]));
      lines.push(line("TCP Auto-Tuning", STATUS_LABEL[optRes?.tcpStatus ?? "unknown"]));
      lines.push(line("Tiết kiệm điện Card WiFi", STATUS_LABEL[optRes?.powerStatus ?? "unknown"]));

      lines.push("");
      lines.push("-- TỐI ƯU NÂNG CAO --");
      lines.push(line("RSS (Receive Side Scaling)", STATUS_LABEL[advRes?.rssStatus ?? "unknown"]));
      lines.push(line("TCP Congestion Provider", STATUS_LABEL[advRes?.congestionStatus ?? "unknown"]));
      lines.push(line("Delivery Optimization P2P", STATUS_LABEL[advRes?.doStatus ?? "unknown"]));

      lines.push("");
      lines.push("-- DRIVER --");
      lines.push(line("Phiên bản", driver?.adapter?.driverVersion || "—"));
      lines.push(line("Ngày phát hành", driver?.adapter?.driverDate || "—"));
      lines.push(line("Đánh giá", driver?.statusText || "—"));

      lines.push("");
      lines.push("-- THỐNG KÊ TỐC ĐỘ --");
      lines.push(line("Tổng số lần đo", stats?.totalTests ? String(stats.totalTests) : "0"));
      lines.push(line("Download trung bình", stats?.avgDownload ? `${stats.avgDownload} Mbps` : "—"));
      lines.push(line("Upload trung bình", stats?.avgUpload ? `${stats.avgUpload} Mbps` : "—"));
      lines.push(line("Ping tốt nhất", stats?.bestLatency ? `${stats.bestLatency} ms` : "—"));
      lines.push(line("Ping tệ nhất", stats?.worstLatency ? `${stats.worstLatency} ms` : "—"));

      if (history.length > 0) {
        lines.push("");
        lines.push(`-- ${Math.min(history.length, 20)} LẦN ĐO GẦN NHẤT --`);
        history.slice(0, 20).forEach((r) => {
          const t = new Date(r.createdAt).toLocaleString("vi-VN");
          lines.push(
            `${t} | DL ${r.downloadMbps ?? "—"} Mbps | UL ${r.uploadMbps ?? "—"} Mbps | Ping ${r.latencyMs ?? "—"} ms | Jitter ${r.jitterMs ?? "—"} ms | ${r.source === "scheduled" ? "Tự động" : "Thủ công"}`
          );
        });
      }

      lines.push("");
      lines.push("=".repeat(56));

      const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wifituner-baocao-${now.toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setMsg("Lỗi khi tạo báo cáo.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-white/50 animate-pulse">Đang tải lịch sử & phân tích Driver…</div>;
  }

  const maxDownload = history.length > 0
    ? Math.max(...history.map((h) => h.downloadMbps || 0), 10)
    : 100;

  return (
    <div className="space-y-8 animate-fade-up">
      {msg && (
        <div className="flex items-center gap-2 rounded-xl border border-accent2/30 bg-accent2/10 px-4 py-3 text-sm text-accent2">
          <Info className="h-4 w-4 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* Driver Health Card */}
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-panel via-panel to-surface p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Cpu className="h-5 w-5 text-accent" />
              <h2 className="text-xl font-bold text-white">Chẩn đoán Driver Card WiFi</h2>
              {driver?.status === "outdated" && (
                <span className="flex items-center gap-1 rounded-full border border-bad/40 bg-bad/20 px-3 py-0.5 text-xs font-semibold text-bad">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Driver quá cũ</span>
                </span>
              )}
              {driver?.status === "up_to_date" && (
                <span className="flex items-center gap-1 rounded-full border border-good/40 bg-good/20 px-3 py-0.5 text-xs font-semibold text-good">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Driver mới</span>
                </span>
              )}
              {driver?.status === "moderate" && (
                <span className="flex items-center gap-1 rounded-full border border-warn/40 bg-warn/20 px-3 py-0.5 text-xs font-semibold text-warn">
                  <Info className="h-3.5 w-3.5" />
                  <span>Ổn định</span>
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
              <span>Kiểm tra Driver tại {driver.vendorName}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 pt-2">
          <StatCard label="Phiên bản Driver" value={driver?.adapter?.driverVersion || "—"} />
          <StatCard label="Ngày phát hành" value={driver?.adapter?.driverDate || "—"} />
          <StatCard label="Tuổi Driver" value={driver?.driverAgeYears != null ? `${driver.driverAgeYears} năm` : "—"} />
          <StatCard label="Đánh giá" value={driver?.statusText || "—"} highlight={driver?.status === "outdated" ? "bad" : "good"} />
        </div>

        <div className="rounded-xl border border-hair bg-black/20 p-4 text-xs text-white/70 flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 text-accent2 mt-0.5" />
          <div>
            <span className="font-semibold text-white/90">Khuyến nghị:</span> {driver?.recommendation}
          </div>
        </div>
      </section>

      {/* Auto Speed Test Schedule Config */}
      <section className="rounded-2xl border border-hair bg-panel p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-accent2" />
            <div>
              <h3 className="text-lg font-semibold text-white">Lên lịch đo tốc độ tự động</h3>
              <p className="text-xs text-white/50">Tự động thực hiện đo tốc độ định kỳ để theo dõi biến động đường truyền.</p>
            </div>
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
                    ? "bg-accent text-white shadow-md"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {autoLaunchSupported && (
          <div
            onClick={handleToggleAutoLaunch}
            className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
              autoLaunch ? "border-good/40 bg-good/5 text-white" : "border-hair bg-black/20 text-white/50 hover:border-white/20"
            } ${autoLaunchBusy ? "opacity-50 pointer-events-none" : ""}`}
          >
            <div className="flex items-center gap-2">
              <Power className={`h-4 w-4 ${autoLaunch ? "text-good" : "text-white/40"}`} />
              <div>
                <span className="text-sm font-semibold">Chạy cùng Windows</span>
                <p className="text-xs text-white/50">
                  Tự khởi động WiFi Tuner (ẩn xuống khay hệ thống) khi đăng nhập Windows, để lịch đo tự động luôn hoạt động.
                </p>
              </div>
            </div>
            <input type="checkbox" checked={autoLaunch} onChange={() => {}} className="h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-white/20 bg-black/30 transition-colors checked:border-good checked:bg-good focus:outline-none focus:ring-0" />
          </div>
        )}
      </section>

      {/* Speed Test Statistics */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Thống kê tổng quan</h3>
          <div className="flex items-center gap-4">
            <button
              onClick={handleExportReport}
              disabled={exporting}
              className="flex items-center gap-1 text-xs text-accent2 hover:underline disabled:opacity-50"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>{exporting ? "Đang tạo báo cáo…" : "Xuất báo cáo"}</span>
            </button>
            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                disabled={clearing}
                className="flex items-center gap-1 text-xs text-bad hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Xóa lịch sử đo</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Tổng số lần đo" value={stats?.totalTests ? String(stats.totalTests) : "0"} />
          <StatCard label="Download trung bình" value={stats?.avgDownload ? `${stats.avgDownload} Mbps` : "—"} highlight="download" />
          <StatCard label="Upload trung bình" value={stats?.avgUpload ? `${stats.avgUpload} Mbps` : "—"} highlight="upload" />
          <StatCard label="Ping tốt nhất" value={stats?.bestLatency ? `${stats.bestLatency} ms` : "—"} />
        </div>
      </section>

      {/* Trend Chart */}
      {history.length > 0 && (
        <section className="space-y-3">
          <HistoryTrendChart records={history} />
        </section>
      )}

      {/* History Timeline */}
      <section className="rounded-2xl border border-hair bg-panel p-6 space-y-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold text-white">Dòng thời gian kết quả đo (SQLite)</h3>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-white/40 py-4 text-center">Chưa có dữ liệu lịch sử đo tốc độ. Hãy thử đo ở tab "Tốc độ".</p>
        ) : (
          <div className="space-y-3">
            {history.map((record, idx) => {
              const dlPercent = record.downloadMbps ? Math.min(100, Math.round((record.downloadMbps / maxDownload) * 100)) : 0;
              return (
                <motion.div
                  key={record.id || record.createdAt}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(idx, 12) * 0.03, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-xl border border-hair bg-white/[0.02] p-4 space-y-2 hover:bg-white/5 transition"
                >
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span className="font-mono text-white/80 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-white/40" />
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
                    <div className="flex items-center gap-1 text-download">
                      <ArrowDown className="h-3.5 w-3.5" />
                      <span>{record.downloadMbps !== null ? `${record.downloadMbps} Mbps` : "—"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-upload">
                      <ArrowUp className="h-3.5 w-3.5" />
                      <span>{record.uploadMbps !== null ? `${record.uploadMbps} Mbps` : "—"}</span>
                    </div>
                    <div className="text-white/80">Ping: {record.latencyMs !== null ? `${record.latencyMs} ms` : "—"}</div>
                    <div className="text-white/50">Jitter: {record.jitterMs !== null ? `${record.jitterMs} ms` : "—"}</div>
                  </div>

                  <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-download to-accent2 rounded-full transition-all duration-500"
                      style={{ width: `${dlPercent}%` }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
