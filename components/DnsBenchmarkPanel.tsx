"use client";

import { useState } from "react";
import { SlidersHorizontal, Zap, CheckCircle2, RefreshCw, Trophy, Server, ShieldCheck } from "lucide-react";
import { KNOWN_DNS_PROVIDERS } from "@/lib/types";
import type { KnownDnsProvider, OptimizationSettings } from "@/lib/types";

interface BenchmarkResult {
  dns: KnownDnsProvider;
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
      KNOWN_DNS_PROVIDERS.map(async (dns) => {
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

  const applyDns = async (dns: KnownDnsProvider) => {
    setApplying(true);
    setFeedback(`Đang áp dụng DNS ${dns.name} (${dns.primary})... Vui lòng xác nhận cửa sổ UAC của Windows.`);

    try {
      // Luôn gửi preset "custom" kèm customDns — máy chủ ưu tiên dùng customDns
      // khi có, nên không cần dnsPreset phải khớp đúng 1 trong 3 preset dựng sẵn.
      const settings: OptimizationSettings = {
        dnsPreset: "custom",
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
            <SlidersHorizontal className="h-6 w-6 text-accent2" />
            <h2 className="text-xl font-bold text-white">Kiểm tra Tốc độ DNS (DNS Benchmark)</h2>
          </div>
          <p className="text-sm text-white/50">
            Tự động đo thời gian phản hồi của các máy chủ DNS phổ biến và chọn ra DNS có tốc độ nhanh nhất.
          </p>
        </div>

        <button
          onClick={runBenchmark}
          disabled={running}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-accent to-accent2 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-50"
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
        <div className="flex items-center gap-2 rounded-xl border border-accent2/30 bg-accent2/10 px-4 py-3 text-sm text-accent2">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Recommended Fastest DNS Banner */}
      {fastest && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-good/40 bg-gradient-to-r from-good/10 via-panel to-panel p-5 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-good text-xs font-bold uppercase tracking-wider">
              <Trophy className="h-4 w-4 text-warn" />
              <span>DNS Nhanh Nhất Được Khuyên Dùng</span>
            </div>
            <h3 className="text-xl font-bold text-white">{fastest.dns.name} ({fastest.dns.primary})</h3>
            <p className="text-xs text-white/60">Độ trễ thấp kỷ lục: <b className="text-good">{fastest.latencyMs} ms</b></p>
          </div>

          <button
            onClick={() => applyDns(fastest.dns)}
            disabled={applying}
            className="flex items-center gap-2 rounded-xl bg-good px-5 py-3 text-xs font-bold text-white shadow-lg hover:brightness-110 transition active:scale-95 disabled:opacity-50"
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
                    idx === 0 ? "bg-warn/20 text-warn border border-warn/40" : "bg-white/5 text-white/60"
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
                      item.status === "fast" ? "text-good" : item.status === "slow" ? "text-bad" : "text-accent2"
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
