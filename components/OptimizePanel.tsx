"use client";

import { useEffect, useState } from "react";
import { Zap, CheckCircle2, ShieldAlert, RotateCcw, Server, Info, ShieldCheck, SlidersHorizontal, RefreshCw, Power } from "lucide-react";
import type { DnsPresetKey, OptimizationSettings, OptimizationStatusResult } from "@/lib/types";
import StatCard from "./StatCard";

const DNS_PRESETS: { id: DnsPresetKey; name: string; servers: string; desc: string }[] = [
  { id: "cloudflare", name: "Cloudflare", servers: "1.1.1.1 / 1.0.0.1", desc: "Tốc độ cực nhanh, bảo mật riêng tư" },
  { id: "google", name: "Google Public DNS", servers: "8.8.8.8 / 8.8.4.4", desc: "Ổn định cao, phân giải tên miền toàn cầu" },
  { id: "quad9", name: "Quad9", servers: "9.9.9.9 / 149.112.112.112", desc: "Tự động chặn các tên miền độc hại/phishing" },
  { id: "dhcp", name: "Mặc định (DHCP)", servers: "Tự động từ Router", desc: "Sử dụng DNS mặc định do nhà mạng/router cấp" },
];

export default function OptimizePanel() {
  const [status, setStatus] = useState<OptimizationStatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "good" | "bad" | "info"; msg: string } | null>(null);

  // Form selections
  const [dnsPreset, setDnsPreset] = useState<DnsPresetKey>("cloudflare");
  const [enableTcp, setEnableTcp] = useState(true);
  const [disablePowerSave, setDisablePowerSave] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/optimize");
      const data = await res.json();
      if (res.ok) {
        setStatus(data);
      } else {
        setFeedback({ type: "bad", msg: data.error || "Không thể tải trạng thái hệ thống." });
      }
    } catch {
      setFeedback({ type: "bad", msg: "Lỗi kết nối tới máy chủ." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleOneClickOptimize = async () => {
    setExecuting(true);
    setFeedback({ type: "info", msg: "Đang yêu cầu quyền Administrator (UAC)... Vui lòng nhấn 'Yes' trên cửa sổ Windows." });

    try {
      const settings: OptimizationSettings = {
        dnsPreset,
        enableTcpTuning: enableTcp,
        disablePowerSave: disablePowerSave,
      };

      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "optimize", settings }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "good", msg: data.message || "Đã áp dụng các tối ưu hoá thành công!" });
        await fetchStatus();
      } else {
        setFeedback({ type: "bad", msg: data.error || "Không thể áp dụng cài đặt tối ưu." });
      }
    } catch (err: any) {
      setFeedback({ type: "bad", msg: err.message || "Lỗi khi thực thi thao tác." });
    } finally {
      setExecuting(false);
    }
  };

  const handleRestore = async () => {
    if (!confirm("Bạn có chắc chắn muốn khôi phục về cấu hình mạng trước khi tối ưu?")) return;

    setExecuting(true);
    setFeedback({ type: "info", msg: "Đang khôi phục cấu hình ban đầu (UAC)..." });

    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "good", msg: data.message || "Đã khôi phục cài đặt mạng ban đầu!" });
        await fetchStatus();
      } else {
        setFeedback({ type: "bad", msg: data.error || "Lỗi khi khôi phục cài đặt." });
      }
    } catch (err: any) {
      setFeedback({ type: "bad", msg: err.message || "Lỗi kết nối khi khôi phục." });
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-white/50 animate-pulse">Đang kiểm tra trạng thái tối ưu hoá hệ thống…</div>;
  }

  return (
    <div className="space-y-8 animate-fade-up">
      {status?.platform === "mock" && (
        <div className="flex items-center gap-2 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          <Info className="h-4 w-4 shrink-0" />
          <span>Chạy trên môi trường không phải Windows — thao tác tối ưu sẽ sử dụng dữ liệu mô phỏng.</span>
        </div>
      )}

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm transition-all ${
            feedback.type === "good"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : feedback.type === "bad"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
              : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
          }`}
        >
          {feedback.type === "good" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : feedback.type === "bad" ? <ShieldAlert className="h-4 w-4 shrink-0" /> : <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Banner 1-Click Optimize */}
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-950/40 via-panel to-panel p-6 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400">
              <Zap className="h-3.5 w-3.5" />
              <span>Tối Ưu Hệ Thống</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Tối ưu WiFi 1-Chạm</h2>
            <p className="text-sm text-white/60 max-w-xl">
              Tự động nâng cao tốc độ truy cập web, giảm ping giật lag và ngăn WiFi tự ngắt kết nối bằng cách tinh chỉnh các thông số hệ thống Windows.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <button
              onClick={handleOneClickOptimize}
              disabled={executing}
              className="group relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 hover:from-blue-500 hover:to-indigo-500 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {executing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  <span>Đang xử lý UAC…</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 fill-current" />
                  <span>Tối Ưu Ngay</span>
                </>
              )}
            </button>

            {status?.backup && (
              <button
                onClick={handleRestore}
                disabled={executing}
                className="flex items-center gap-1.5 text-xs text-white/50 hover:text-rose-400 transition underline underline-offset-4"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Khôi phục cấu hình cũ ({new Date(status.backup.createdAt).toLocaleDateString("vi-VN")})</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Trạng thái hiện tại */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Trạng thái chẩn đoán hệ thống</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Máy chủ DNS"
            value={status?.dnsStatus === "optimized" ? "Đã tối ưu" : "Mặc định / Chưa tối ưu"}
            highlight={status?.dnsStatus === "optimized" ? "good" : "warn"}
            sub={status?.dnsStatus === "optimized" ? "DNS công cộng tốc độ cao" : "Nên đổi sang Cloudflare hoặc Google"}
          />
          <StatCard
            label="TCP Auto-Tuning"
            value={status?.tcpStatus === "optimized" ? "Normal (Bật)" : "Tắt / Giới hạn"}
            highlight={status?.tcpStatus === "optimized" ? "good" : "warn"}
            sub={status?.tcpStatus === "optimized" ? "Tận dụng tối đa băng thông" : "Nên bật mức Normal"}
          />
          <StatCard
            label="Tiết kiệm điện Card WiFi"
            value={status?.powerStatus === "optimized" ? "Đã tắt (Tốt)" : "Đang bật (Có thể rớt mạng)"}
            highlight={status?.powerStatus === "optimized" ? "good" : "warn"}
            sub={status?.powerStatus === "optimized" ? "Giữ kết nối WiFi luôn hoạt động" : "Windows có thể tự ngắt WiFi để tiết kiệm pin"}
          />
        </div>
      </section>

      {/* Tùy chỉnh chi tiết */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Cấu hình tinh chỉnh</h3>

        {/* DNS Selection */}
        <div className="rounded-xl border border-hair bg-panel p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-cyan-400" />
            <div>
              <h4 className="text-sm font-medium text-white/90">1. Chọn máy chủ DNS mục tiêu</h4>
              <p className="text-xs text-white/50">Đổi DNS giúp tăng tốc độ tải trang web và vượt rào cản phân giải tên miền.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DNS_PRESETS.map((preset) => (
              <div
                key={preset.id}
                onClick={() => setDnsPreset(preset.id)}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  dnsPreset === preset.id
                    ? "border-indigo-500 bg-indigo-500/10 text-white"
                    : "border-hair bg-white/[0.02] text-white/70 hover:border-white/20 hover:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{preset.name}</span>
                  <span className="text-xs font-mono text-indigo-400">{preset.servers}</span>
                </div>
                <p className="mt-1 text-xs text-white/50">{preset.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Options Toggles */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* TCP Tuning Toggle */}
          <div
            onClick={() => setEnableTcp(!enableTcp)}
            className={`cursor-pointer rounded-xl border p-4 transition-all flex items-start justify-between ${
              enableTcp
                ? "border-emerald-500/40 bg-emerald-500/5 text-white"
                : "border-hair bg-panel text-white/50 hover:border-white/20"
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <SlidersHorizontal className="h-4 w-4 text-emerald-400" />
                <span>2. Tinh chỉnh TCP Auto-Tuning (Normal)</span>
              </div>
              <p className="text-xs text-white/50">Tự động tối ưu kích thước Receive Window buffer cho mạng tốc độ cao.</p>
            </div>
            <input
              type="checkbox"
              checked={enableTcp}
              onChange={() => {}}
              className="h-5 w-5 rounded border-hair bg-black/40 text-emerald-500 focus:ring-0"
            />
          </div>

          {/* Power Saving Toggle */}
          <div
            onClick={() => setDisablePowerSave(!disablePowerSave)}
            className={`cursor-pointer rounded-xl border p-4 transition-all flex items-start justify-between ${
              disablePowerSave
                ? "border-emerald-500/40 bg-emerald-500/5 text-white"
                : "border-hair bg-panel text-white/50 hover:border-white/20"
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Power className="h-4 w-4 text-emerald-400" />
                <span>3. Tắt tiết kiệm điện Card WiFi</span>
              </div>
              <p className="text-xs text-white/50">Ngăn không cho Windows tắt tạm thời Card WiFi để giữ Ping ổn định.</p>
            </div>
            <input
              type="checkbox"
              checked={disablePowerSave}
              onChange={() => {}}
              className="h-5 w-5 rounded border-hair bg-black/40 text-emerald-500 focus:ring-0"
            />
          </div>
        </div>
      </section>

      {/* Note about Admin elevation */}
      <footer className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-white/40 space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-white/60">
          <ShieldCheck className="h-4 w-4 text-indigo-400" />
          <span>Lưu ý về quyền Administrator & Sao lưu:</span>
        </div>
        <p>- Các thao tác đổi DNS/TCP/Card mạng trên Windows cần quyền Quản trị viên (Admin).</p>
        <p>- Cửa sổ Windows UAC sẽ xuất hiện khi bấm tối ưu. Hãy chọn <b>Yes</b> để tiếp tục.</p>
        <p>- Bản sao lưu cấu hình cũ luôn được lưu lại an toàn để bạn khôi phục bất kỳ lúc nào.</p>
      </footer>
    </div>
  );
}
