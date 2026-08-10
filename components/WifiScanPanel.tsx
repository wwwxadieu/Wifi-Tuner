"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wifi, RefreshCw, Info, AlertCircle, Zap } from "lucide-react";
import type { WifiScanResult } from "@/lib/types";

function signalColor(percent: number) {
  if (percent >= 70) return "bg-good";
  if (percent >= 40) return "bg-warn";
  return "bg-bad";
}

export default function WifiScanPanel() {
  const [scan, setScan] = useState<WifiScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/wifi-scan")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setScan(data);
      })
      .catch(() => setError("Không thể quét mạng WiFi lân cận"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wifi className="h-5 w-5 text-accent" />
          <div>
            <h2 className="text-lg font-semibold">WiFi lân cận</h2>
            <p className="text-sm text-white/50">Danh sách mạng xung quanh, kênh và mức độ chồng lấn sóng.</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-full border border-hair px-4 py-1.5 text-sm text-white/70 transition hover:bg-white/5 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          <span>{loading ? "Đang quét…" : "Quét lại"}</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {scan?.platform === "mock" && (
        <div className="flex items-center gap-2 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          <Info className="h-4 w-4 shrink-0" />
          <span>Đang chạy trên môi trường không phải Windows — hiển thị dữ liệu mẫu để minh hoạ giao diện.</span>
        </div>
      )}

      {scan && scan.suggestedChannel24 !== null && (
        <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          <Zap className="h-4 w-4 shrink-0" />
          <span>
            Kênh 2.4GHz ít bị chiếm dụng nhất trong khu vực: <strong>kênh {scan.suggestedChannel24}</strong>. Đổi kênh
            này trong trang quản trị router để giảm nhiễu — app không thể tự đổi hộ.
          </span>
        </div>
      )}

      {scan && scan.networks.length === 0 && !error && (
        <p className="text-sm text-white/50">Không tìm thấy mạng WiFi nào lân cận, hoặc adapter WiFi đang tắt.</p>
      )}

      {scan && scan.networks.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-hair">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-white/40">
              <tr>
                <th className="px-4 py-3 font-medium">SSID</th>
                <th className="px-4 py-3 font-medium">Băng tần</th>
                <th className="px-4 py-3 font-medium">Kênh</th>
                <th className="px-4 py-3 font-medium">Bảo mật</th>
                <th className="px-4 py-3 font-medium">Tín hiệu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {scan.networks.map((net, idx) => (
                <motion.tr
                  key={`${net.bssid}-${net.ssid}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(idx, 12) * 0.03, ease: [0.16, 1, 0.3, 1] }}
                  className="text-white/80">
                  <td className="px-4 py-3">{net.ssid}</td>
                  <td className="px-4 py-3 text-white/50">{net.band}</td>
                  <td className="px-4 py-3 text-white/50">{net.channel}</td>
                  <td className="px-4 py-3 text-white/50">{net.authentication}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full ${signalColor(net.signalPercent)}`}
                          style={{ width: `${net.signalPercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-white/50">{net.signalPercent}%</span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
