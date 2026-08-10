"use client";

import { useState } from "react";
import { SlidersHorizontal, Zap, CheckCircle2, RefreshCw, Trophy, Server, ShieldCheck } from "lucide-react";
import type { DnsPresetKey, OptimizationSettings } from "@/lib/types";

interface DnsItem {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  provider: string;
}

const DNS_LIST: DnsItem[] = [
  { id: "cloudflare", name: "Cloudflare DNS", primary: "1.1.1.1", secondary: "1.0.0.1", provider: "Cloudflare" },
  { id: "google", name: "Google Public DNS", primary: "8.8.8.8", secondary: "8.8.4.4", provider: "Google" },
  { id: "quad9", name: "Quad9 Security", primary: "9.9.9.9", secondary: "149.112.112.112", provider: "Quad9" },
  { id: "opendns", name: "OpenDNS Home", primary: "208.67.222.222", secondary: "208.67.220.220", provider: "Cisco" },
  { id: "adguard", name: "AdGuard DNS (Chặn QC)", primary: "94.140.14.14", secondary: "94.140.15.15", provider: "AdGuard" },
  { id: "viettel", name: "Viettel DNS", primary: "203.119.9.9", secondary: "203.119.9.10", provider: "Viettel ISP" },
  { id: "vnpt", name: "VNPT DNS", primary: "203.162.4.190", secondary: "203.162.4.191", provider: "VNPT ISP" },
  { id: "fpt", name: "FPT Telecom DNS", primary: "210.245.24.20", secondary: "210.245.24.22", provider: "FPT Telecom" },
];

interface BenchmarkResult {
  dns: DnsItem;
  latencyMs: number | null;
  status: "fast" | "normal" | "slow" | "error";
}

export default function DnsBenchmarkPanel() {
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const runBenchmark = async () => {
    setRunning(true);
    setFeedback(null);
    setResults([]);

    const resList: BenchmarkResult[] = [];

    await Promise.all(
      DNS_LIST.map(async (dns) => {
        try {
          const res = await fetch("/api/ping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ host: dns.primary }),
          });
          const data = await res.json();
          if (res.ok && data.avgMs !== null) {
            const ms = data.avgMs as number;
            let status: "fast" | "normal" | "slow" = "normal";
            if (ms <= 25) status = "fast";
            else if (ms > 70) status = "slow";
            resList.push({ dns, latencyMs: ms, status });
          } else {
            resList.push({ dns, latencyMs: null, status: "error" });
          }
        } catch {
          resList.push({ dns, latencyMs: null, status: "error" });
        }
      })
    );

    // Sort by latency ascending
    resList.sort((a, b) => {
      if (a.latencyMs === null) return 1;
      if (b.latencyMs === null) return -1;
      return a.latencyMs - b.latencyMs;
    });

    setResults(resList);
    setRunning(false);
  };

  const applyDns = async (dns: DnsItem) => {
    setApplying(true);
    setFeedback(`Đang áp dụng DNS ${dns.name} (${dns.primary})... Vui lòng xác nhận cửa sổ UAC của Windows.`);

    try {
      const settings: OptimizationSettings = {
        dnsPreset: dns.id as DnsPresetKey,
        customDns: [dns.primary, dns.secondary],
        enableTcpTuning: true,
        disablePowerSave: true,
      };

      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "optimize", settings }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback(`✓ Đã áp dụng thành công DNS ${dns.name} (${dns.primary})!`);
      } else {
        setFeedback(`Lỗi: ${data.error || "Không thể đổi DNS."}`);
      }
    } catch {
      setFeedback("Lỗi kết nối khi áp dụng DNS.");
    } finally {
      setApplying(false);
    }
  };

  const fastest = results.find((r) => r.latencyMs !== null);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-6 w-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Kiểm tra Tốc độ DNS (DNS Benchmark)</h2>
          </div>
          <p className="text-sm text-white/50">
            Tự động đo thời gian phản hồi của các máy chủ DNS phổ biến và chọn ra DNS có tốc độ nhanh nhất.
          </p>
        </div>

        <button
          onClick={runBenchmark}
          disabled={running}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          {running ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Đang đo tốc độ DNS…</span>
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 fill-current" />
              <span>Chạy DNS Benchmark</span>
            </>
          )}
        </button>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Recommended Fastest DNS Banner */}
      {fastest && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-panel to-panel p-5 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span>DNS Nhanh Nhất Được Khuyên Dùng</span>
            </div>
            <h3 className="text-xl font-bold text-white">{fastest.dns.name} ({fastest.dns.primary})</h3>
            <p className="text-xs text-white/60">Độ trễ thấp kỷ lục: <b className="text-emerald-400">{fastest.latencyMs} ms</b></p>
          </div>

          <button
            onClick={() => applyDns(fastest.dns)}
            disabled={applying}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-lg hover:bg-emerald-500 transition active:scale-95 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Áp dụng DNS Nhanh Nhất (1-Click)</span>
          </button>
        </div>
      )}

      {/* Results List */}
      <div className="rounded-2xl border border-hair bg-panel p-6 space-y-3">
        <h3 className="text-base font-semibold text-white">Kết quả so sánh độ trễ</h3>

        {results.length === 0 ? (
          <p className="text-sm text-white/40 py-6 text-center">Bấm nút "Chạy DNS Benchmark" để đo tốc độ các máy chủ DNS.</p>
        ) : (
          <div className="space-y-2">
            {results.map((item, idx) => (
              <div
                key={item.dns.id}
                className="flex items-center justify-between rounded-xl border border-hair bg-white/[0.02] p-3.5 hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-3">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                    idx === 0 ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "bg-white/5 text-white/60"
                  }`}>
                    #{idx + 1}
                  </span>
                  <div>
                    <h4 className="font-semibold text-white text-sm">{item.dns.name}</h4>
                    <span className="text-xs font-mono text-white/50">{item.dns.primary} / {item.dns.secondary}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {item.latencyMs !== null ? (
                    <span className={`font-mono font-bold text-sm ${
                      item.status === "fast" ? "text-emerald-400" : item.status === "slow" ? "text-rose-400" : "text-cyan-300"
                    }`}>
                      {item.latencyMs} ms
                    </span>
                  ) : (
                    <span className="text-xs text-white/40">Lỗi kết nối</span>
                  )}

                  <button
                    onClick={() => applyDns(item.dns)}
                    disabled={applying}
                    className="rounded-lg border border-hair bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white transition"
                  >
                    Đổi DNS
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
