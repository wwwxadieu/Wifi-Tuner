"use client";

import { useEffect, useState } from "react";
import {
  Rocket,
  CheckCircle2,
  ShieldAlert,
  RotateCcw,
  Info,
  RefreshCw,
  Cpu,
  Share2,
  Gauge,
  Wrench,
  ChevronDown,
  ChevronUp,
  ListTree,
} from "lucide-react";
import type { AdvancedOptimizationStatusResult, CongestionProviderKey } from "@/lib/types";
import StatCard from "./StatCard";

const CONGESTION_OPTIONS: { id: CongestionProviderKey; name: string; desc: string }[] = [
  { id: "Default", name: "Mặc định (New Reno)", desc: "Thuật toán TCP tiêu chuẩn có sẵn của Windows" },
  { id: "CTCP", name: "CTCP (Khuyên dùng)", desc: "Tận dụng băng thông tốt hơn trên đường truyền tốc độ cao, độ trễ lớn" },
];

export default function AdvancedOptimizePanel() {
  const [status, setStatus] = useState<AdvancedOptimizationStatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "good" | "bad" | "info"; msg: string } | null>(null);
  const [showProperties, setShowProperties] = useState(false);

  const [enableRss, setEnableRss] = useState(true);
  const [congestionProvider, setCongestionProvider] = useState<CongestionProviderKey>("CTCP");
  const [disableDoP2P, setDisableDoP2P] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/advanced-optimize");
      const data = await res.json();
      if (res.ok) {
        setStatus(data);
      } else {
        setFeedback({ type: "bad", msg: data.error || "Không thể tải trạng thái tinh chỉnh nâng cao." });
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

  const handleApply = async () => {
    setExecuting(true);
    setFeedback({ type: "info", msg: "Đang yêu cầu quyền Administrator (UAC)... Vui lòng nhấn 'Yes' trên cửa sổ Windows." });

    try {
      const res = await fetch("/api/advanced-optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          settings: { enableRss, congestionProvider, disableDeliveryOptimizationP2P: disableDoP2P },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "good", msg: data.message || "Đã áp dụng tinh chỉnh nâng cao thành công!" });
        await fetchStatus();
      } else {
        setFeedback({ type: "bad", msg: data.error || "Không thể áp dụng tinh chỉnh nâng cao." });
      }
    } catch (err: any) {
      setFeedback({ type: "bad", msg: err.message || "Lỗi khi thực thi thao tác." });
    } finally {
      setExecuting(false);
    }
  };

  const handleRestore = async () => {
    if (!confirm("Bạn có chắc chắn muốn khôi phục toàn bộ cấu hình mạng (cơ bản + nâng cao) về trước khi tối ưu?")) return;

    setExecuting(true);
    setFeedback({ type: "info", msg: "Đang khôi phục cấu hình ban đầu (UAC)..." });

    try {
      const res = await fetch("/api/advanced-optimize", {
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

  const handleWinsockReset = async () => {
    if (
      !confirm(
        "Thao tác này sẽ đặt lại TOÀN BỘ ngăn xếp mạng Winsock/TCP-IP của Windows về mặc định gốc (áp dụng cho mọi card mạng, không riêng WiFi) và cần KHỞI ĐỘNG LẠI máy để có hiệu lực. Chỉ dùng khi máy đang gặp lỗi kết nối mạng. Tiếp tục?"
      )
    )
      return;

    setResetting(true);
    setFeedback({ type: "info", msg: "Đang yêu cầu quyền Administrator (UAC) để đặt lại Winsock/TCP-IP..." });

    try {
      const res = await fetch("/api/advanced-optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "winsock_reset" }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "good", msg: data.message || "Đã đặt lại Winsock/TCP-IP thành công." });
      } else {
        setFeedback({ type: "bad", msg: data.error || "Không thể đặt lại Winsock/TCP-IP." });
      }
    } catch (err: any) {
      setFeedback({ type: "bad", msg: err.message || "Lỗi khi thực thi thao tác." });
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-white/50 animate-pulse">Đang kiểm tra trạng thái tinh chỉnh nâng cao…</div>;
  }

  const executingAny = executing || resetting;

  return (
    <div className="space-y-8 animate-fade-up">
      {status?.platform === "mock" && (
        <div className="flex items-center gap-2 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          <Info className="h-4 w-4 shrink-0" />
          <span>Chạy trên môi trường không phải Windows — thao tác tinh chỉnh sẽ sử dụng dữ liệu mô phỏng.</span>
        </div>
      )}

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm transition-all ${
            feedback.type === "good"
              ? "border-good/30 bg-good/10 text-good"
              : feedback.type === "bad"
              ? "border-bad/30 bg-bad/10 text-bad"
              : "border-accent2/30 bg-accent2/10 text-accent2"
          }`}
        >
          {feedback.type === "good" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : feedback.type === "bad" ? <ShieldAlert className="h-4 w-4 shrink-0" /> : <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-accent2/10 via-panel to-panel p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-accent2/30 bg-accent2/10 px-3 py-1 text-xs font-semibold text-accent2">
              <Rocket className="h-3.5 w-3.5" />
              <span>Tinh Chỉnh Sâu Windows</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Tối ưu WiFi nâng cao</h2>
            <p className="text-sm text-white/60 max-w-xl">
              Điều chỉnh các thông số hệ thống ở tầng sâu hơn: phân tán tải xử lý mạng qua nhiều lõi CPU (RSS), thuật
              toán kiểm soát nghẽn TCP, và chia sẻ băng thông qua Windows Delivery Optimization.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <button
              onClick={handleApply}
              disabled={executingAny}
              className="group relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent2 to-accent px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-accent2/30 transition-all hover:scale-105 hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {executing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  <span>Đang xử lý UAC…</span>
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 fill-current" />
                  <span>Áp Dụng Tinh Chỉnh</span>
                </>
              )}
            </button>

            {status?.backup && (
              <button
                onClick={handleRestore}
                disabled={executingAny}
                className="flex items-center gap-1.5 text-xs text-white/50 hover:text-bad transition underline underline-offset-4"
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
        <h3 className="text-lg font-semibold text-white">Trạng thái chẩn đoán nâng cao</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="RSS (Receive Side Scaling)"
            value={status?.rssStatus === "optimized" ? "Đã bật" : status?.rssStatus === "suboptimal" ? "Đang tắt" : "Không rõ"}
            highlight={status?.rssStatus === "optimized" ? "good" : status?.rssStatus === "suboptimal" ? "warn" : undefined}
            icon={Cpu}
            sub={status?.rssStatus === "optimized" ? "Xử lý gói tin qua nhiều lõi CPU" : "Nên bật để giảm nghẽn tại 1 lõi CPU"}
          />
          <StatCard
            label="TCP Congestion Provider"
            value={status?.congestionStatus === "optimized" ? "CTCP" : status?.congestionStatus === "suboptimal" ? "Mặc định" : "Không rõ"}
            highlight={status?.congestionStatus === "optimized" ? "good" : status?.congestionStatus === "suboptimal" ? "warn" : undefined}
            icon={Gauge}
            sub={status?.congestionStatus === "optimized" ? "Tận dụng tối đa băng thông độ trễ cao" : "Nên đổi sang CTCP"}
          />
          <StatCard
            label="Delivery Optimization P2P"
            value={status?.doStatus === "optimized" ? "Đã tắt (Tốt)" : status?.doStatus === "suboptimal" ? "Đang bật" : "Không rõ"}
            highlight={status?.doStatus === "optimized" ? "good" : status?.doStatus === "suboptimal" ? "warn" : undefined}
            icon={Share2}
            sub={status?.doStatus === "optimized" ? "Không chia sẻ băng thông upload cho máy khác" : "Windows Update có thể chiếm băng thông upload"}
          />
        </div>
      </section>

      {/* Tùy chỉnh chi tiết */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Cấu hình tinh chỉnh nâng cao</h3>

        {/* Congestion Provider Selection */}
        <div className="rounded-xl border border-hair bg-panel p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-accent2" />
            <div>
              <h4 className="text-sm font-medium text-white/90">1. Thuật toán kiểm soát nghẽn TCP</h4>
              <p className="text-xs text-white/50">Ảnh hưởng tới tốc độ tận dụng băng thông trên đường truyền có độ trễ (ping) cao.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CONGESTION_OPTIONS.map((opt) => (
              <div
                key={opt.id}
                onClick={() => setCongestionProvider(opt.id)}
                className={`cursor-pointer rounded-xl border p-4 transition-all ${
                  congestionProvider === opt.id
                    ? "border-accent bg-accent/10 text-white"
                    : "border-hair bg-white/[0.02] text-white/70 hover:border-white/20 hover:bg-white/5"
                }`}
              >
                <span className="font-semibold text-sm">{opt.name}</span>
                <p className="mt-1 text-xs text-white/50">{opt.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Options Toggles */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div
            onClick={() => setEnableRss(!enableRss)}
            className={`cursor-pointer rounded-xl border p-4 transition-all flex items-start justify-between ${
              enableRss ? "border-good/40 bg-good/5 text-white" : "border-hair bg-panel text-white/50 hover:border-white/20"
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Cpu className="h-4 w-4 text-good" />
                <span>2. Bật RSS (phân tán tải qua nhiều lõi CPU)</span>
              </div>
              <p className="text-xs text-white/50">Giảm nghẽn xử lý mạng khi tốc độ WiFi cao, đặc biệt hữu ích trên CPU nhiều lõi.</p>
            </div>
            <input type="checkbox" checked={enableRss} onChange={() => {}} className="h-5 w-5 rounded border-hair bg-black/40 text-good focus:ring-0" />
          </div>

          <div
            onClick={() => setDisableDoP2P(!disableDoP2P)}
            className={`cursor-pointer rounded-xl border p-4 transition-all flex items-start justify-between ${
              disableDoP2P ? "border-good/40 bg-good/5 text-white" : "border-hair bg-panel text-white/50 hover:border-white/20"
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Share2 className="h-4 w-4 text-good" />
                <span>3. Tắt chia sẻ P2P (Delivery Optimization)</span>
              </div>
              <p className="text-xs text-white/50">Ngăn Windows Update tải/tải lên bản cập nhật từ các máy khác trên Internet, chiếm băng thông của bạn.</p>
            </div>
            <input type="checkbox" checked={disableDoP2P} onChange={() => {}} className="h-5 w-5 rounded border-hair bg-black/40 text-good focus:ring-0" />
          </div>
        </div>
      </section>

      {/* Advanced driver properties - read only */}
      {status && status.advancedProperties.length > 0 && (
        <section className="space-y-3">
          <button
            onClick={() => setShowProperties((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-hair bg-panel p-4 text-left transition hover:border-white/20"
          >
            <div className="flex items-center gap-2">
              <ListTree className="h-4 w-4 text-accent2" />
              <div>
                <h4 className="text-sm font-medium text-white/90">Thông số driver nâng cao (chỉ xem)</h4>
                <p className="text-xs text-white/50">Đặc thù theo hãng sản xuất card WiFi — hiển thị để tham khảo, không tự động thay đổi.</p>
              </div>
            </div>
            {showProperties ? <ChevronUp className="h-4 w-4 text-white/40" /> : <ChevronDown className="h-4 w-4 text-white/40" />}
          </button>

          {showProperties && (
            <div className="overflow-hidden rounded-xl border border-hair bg-panel">
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-panel">
                    <tr className="border-b border-hair text-xs uppercase tracking-wide text-white/40">
                      <th className="px-4 py-2 font-medium">Thông số</th>
                      <th className="px-4 py-2 font-medium">Giá trị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.advancedProperties.map((prop, idx) => (
                      <tr key={`${prop.displayName}-${idx}`} className="border-b border-hair/50 last:border-0">
                        <td className="px-4 py-2 text-white/80">{prop.displayName}</td>
                        <td className="px-4 py-2 text-white/60">{prop.displayValue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Winsock/TCP-IP repair */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Sửa lỗi mạng nâng cao</h3>
        <div className="rounded-xl border border-bad/30 bg-bad/5 p-5 space-y-4">
          <div className="flex items-start gap-2">
            <Wrench className="h-4 w-4 text-bad shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-white/90">Đặt lại Winsock &amp; TCP/IP</h4>
              <p className="text-xs text-white/50 mt-1">
                Công cụ sửa lỗi cho các sự cố mạng nghiêm trọng (mất kết nối Internet dù WiFi vẫn "Connected", lỗi
                DNS lạ...). Đặt lại toàn bộ ngăn xếp mạng của Windows về mặc định gốc.{" "}
                <b className="text-bad">Cần khởi động lại máy tính sau khi thực hiện.</b>
              </p>
            </div>
          </div>
          <button
            onClick={handleWinsockReset}
            disabled={executingAny}
            className="inline-flex items-center gap-2 rounded-xl border border-bad/40 bg-bad/10 px-4 py-2.5 text-sm font-semibold text-bad transition-all hover:bg-bad/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            {resetting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
            <span>{resetting ? "Đang xử lý UAC…" : "Đặt lại Winsock / TCP-IP"}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
