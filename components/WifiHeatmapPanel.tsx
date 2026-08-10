"use client";

import { useEffect, useState } from "react";
import { Radio, Signal, Wifi, RefreshCw, AlertCircle, CheckCircle2, Info, Zap } from "lucide-react";
import type { WifiScanResult } from "@/lib/types";

export default function WifiHeatmapPanel() {
  const [data, setData] = useState<WifiScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const fetchScan = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/wifi-scan");
      const json = await res.json();
      if (res.ok) setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setScanning(false);
    }
  };

  useEffect(() => {
    fetchScan();
  }, []);

  const networks = data?.networks || [];
  const channels24 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

  // Count networks per channel
  const channelCounts: Record<number, number> = {};
  channels24.forEach((c) => (channelCounts[c] = 0));
  networks.forEach((n) => {
    if (n.channel >= 1 && n.channel <= 13) {
      channelCounts[n.channel] = (channelCounts[n.channel] || 0) + 1;
    }
  });

  const bestChannel = data?.suggestedChannel24 || 1;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Radio className="h-6 w-6 text-accent" />
            <h2 className="text-xl font-bold text-white">Biểu đồ Tín hiệu & Trực quan hóa Kênh WiFi</h2>
          </div>
          <p className="text-sm text-white/50">
            Theo dõi mật độ điểm truy cập WiFi xung quanh để phát hiện trùng lặp kênh và tối ưu router.
          </p>
        </div>

        <button
          onClick={fetchScan}
          disabled={scanning}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-accent to-accent2 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
          <span>Quét lại tần số</span>
        </button>
      </div>

      {/* Suggested Channel Card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-accent/40 bg-gradient-to-r from-accent/10 via-panel to-panel p-5 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 border border-accent/40 text-accent font-bold text-xl font-mono">
            #{bestChannel}
          </div>
          <div>
            <div className="flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-wider">
              <Zap className="h-4 w-4" />
              <span>Kênh WiFi 2.4GHz Khuyên Dùng</span>
            </div>
            <h3 className="text-lg font-bold text-white">Kênh #{bestChannel} ít bị nhiễu nhất</h3>
            <p className="text-xs text-white/60">Đổi router về kênh này giúp đường truyền ổn định và tránh nghẽn mạng.</p>
          </div>
        </div>
      </div>

      {/* 2.4GHz Spectrum Heatmap */}
      <div className="rounded-2xl border border-hair bg-panel p-6 space-y-4">
        <h3 className="text-base font-semibold text-white">Phổ tần Kênh 2.4GHz (Mật độ kết nối)</h3>

        {loading ? (
          <div className="text-sm text-white/40 animate-pulse">Đang quét phổ tần WiFi…</div>
        ) : (
          <div className="grid grid-cols-13 gap-1.5 pt-4">
            {channels24.map((ch) => {
              const count = channelCounts[ch] || 0;
              const isBest = ch === bestChannel;
              const heightPct = Math.min(100, Math.max(15, count * 30));

              return (
                <div key={ch} className="flex flex-col items-center gap-2">
                  <div className="relative flex h-32 w-full items-end justify-center rounded-xl bg-black/40 p-1">
                    <div
                      className={`w-full rounded-lg transition-all duration-500 ${
                        isBest
                          ? "bg-gradient-to-t from-good to-accent2 shadow-lg shadow-good/30"
                          : count > 2
                          ? "bg-gradient-to-t from-bad to-warn"
                          : count > 0
                          ? "bg-gradient-to-t from-accent to-accent2"
                          : "bg-white/5"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    {count > 0 && (
                      <span className="absolute bottom-2 font-mono text-[10px] font-bold text-white">
                        {count}
                      </span>
                    )}
                  </div>
                  <span className={`font-mono text-xs font-semibold ${isBest ? "text-good" : "text-white/60"}`}>
                    ch {ch}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Nearby Networks Details */}
      <div className="rounded-2xl border border-hair bg-panel p-6 space-y-4">
        <h3 className="text-base font-semibold text-white">Danh sách các WiFi lân cận ({networks.length} mạng)</h3>
        <div className="space-y-2">
          {networks.map((net, idx) => (
            <div
              key={net.bssid || idx}
              className="flex items-center justify-between rounded-xl border border-hair bg-white/[0.02] p-3 hover:bg-white/5 transition"
            >
              <div className="flex items-center gap-3">
                <Wifi className={`h-4 w-4 ${net.signalPercent > 70 ? "text-good" : net.signalPercent > 40 ? "text-accent2" : "text-warn"}`} />
                <div>
                  <h4 className="font-semibold text-white text-sm">{net.ssid || "WiFi Ẩn (Hidden)"}</h4>
                  <span className="text-xs text-white/40 font-mono">{net.bssid} • Kênh {net.channel} ({net.band})</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-white/80">{net.signalPercent}%</span>
                <div className="h-2 w-16 bg-black/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent2 to-accent rounded-full"
                    style={{ width: `${net.signalPercent}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
