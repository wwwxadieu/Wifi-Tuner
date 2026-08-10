"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, RefreshCw, Signal } from "lucide-react";
import StatCard from "./StatCard";
import { KNOWN_DNS_PROVIDERS } from "@/lib/types";
import type { KnownDnsProvider } from "@/lib/types";

interface PingStabilityResult {
  host: string;
  minMs: number | null;
  maxMs: number | null;
  avgMs: number | null;
  jitterMs: number | null;
  lossPercent: number;
  grade: "S" | "A" | "B" | "C" | "D";
}

export default function DnsPingPanel() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<Record<string, PingStabilityResult | "loading" | "error">>({});

  const runTest = async () => {
    setTesting(true);
    setResults(Object.fromEntries(KNOWN_DNS_PROVIDERS.map((d) => [d.id, "loading" as const])));

    await Promise.all(
      KNOWN_DNS_PROVIDERS.map(async (dns: KnownDnsProvider) => {
        try {
          const res = await fetch("/api/ping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ host: dns.primary }),
          });
          const data = await res.json();
          if (res.ok && data.samples) {
            const valid = data.samples.filter((s: any) => s.ok && s.ms !== null).map((s: any) => s.ms as number);
            const lossPercent = Math.round(((data.samples.length - valid.length) / data.samples.length) * 100);

            if (valid.length > 0) {
              const minMs = Math.min(...valid);
              const maxMs = Math.max(...valid);
              const avgMs = Math.round(valid.reduce((a: number, b: number) => a + b, 0) / valid.length);
              const jitterMs = Math.round(maxMs - minMs);

              let grade: "S" | "A" | "B" | "C" | "D" = "A";
              if (avgMs <= 15 && jitterMs <= 5 && lossPercent === 0) grade = "S";
              else if (avgMs <= 35 && jitterMs <= 10 && lossPercent === 0) grade = "A";
              else if (avgMs <= 60 && jitterMs <= 20 && lossPercent <= 5) grade = "B";
              else if (avgMs <= 100) grade = "C";
              else grade = "D";

              setResults((prev) => ({
                ...prev,
                [dns.id]: { host: dns.primary, minMs, maxMs, avgMs, jitterMs, lossPercent, grade },
              }));
              return;
            }
          }
          setResults((prev) => ({ ...prev, [dns.id]: "error" }));
        } catch {
          setResults((prev) => ({ ...prev, [dns.id]: "error" }));
        }
      })
    );

    setTesting(false);
  };

  const getGradeBadge = (grade: "S" | "A" | "B" | "C" | "D") => {
    switch (grade) {
      case "S":
        return <span className="rounded-full bg-good/20 border border-good/40 px-3 py-1 text-xs font-bold text-good">Hạng S • Hoàn Hảo</span>;
      case "A":
        return <span className="rounded-full bg-accent2/20 border border-accent2/40 px-3 py-1 text-xs font-bold text-accent2">Hạng A • Mượt Mà</span>;
      case "B":
        return <span className="rounded-full bg-accent/20 border border-accent/40 px-3 py-1 text-xs font-bold text-accent">Hạng B • Khá Tốt</span>;
      case "C":
        return <span className="rounded-full bg-warn/20 border border-warn/40 px-3 py-1 text-xs font-bold text-warn">Hạng C • Hơi Giật</span>;
      case "D":
        return <span className="rounded-full bg-bad/20 border border-bad/40 px-3 py-1 text-xs font-bold text-bad">Hạng D • Lag / Rớt Gói</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Signal className="h-6 w-6 text-accent" />
            <h2 className="text-xl font-bold text-white">So sánh độ ổn định Ping tới DNS</h2>
          </div>
          <p className="text-sm text-white/50">
            Đo biến động Ping (Jitter) và tỷ lệ mất gói tin (Packet Loss %) tới các máy chủ DNS phổ biến — hữu ích để
            ước lượng độ ổn định đường truyền, không phải ping thật tới máy chủ trò chơi.
          </p>
        </div>

        <button
          onClick={runTest}
          disabled={testing}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-accent to-accent2 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          {testing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Đang kiểm tra Ping…</span>
            </>
          ) : (
            <>
              <Activity className="h-4 w-4" />
              <span>Đo Ping</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {KNOWN_DNS_PROVIDERS.map((dns, idx) => {
          const res = results[dns.id];
          const isLoading = res === "loading";
          const isError = res === "error";
          const data = typeof res === "object" ? res : null;

          return (
            <motion.div
              key={dns.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border border-hair bg-panel p-5 space-y-3 hover:border-white/20 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 text-accent">
                    <Signal className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-base">{dns.name}</h3>
                    <span className="text-xs text-white/40 font-mono">{dns.primary} • {dns.provider}</span>
                  </div>
                </div>

                <div>
                  {isLoading && <span className="text-xs text-white/40 animate-pulse">Đang đo ping…</span>}
                  {isError && <span className="text-xs text-bad">Lỗi kết nối máy chủ</span>}
                  {data && getGradeBadge(data.grade)}
                </div>
              </div>

              {data && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-hair/40">
                  <StatCard label="Ping trung bình" value={`${data.avgMs} ms`} highlight="accent" />
                  <StatCard label="Biến động (Jitter)" value={`${data.jitterMs} ms`} highlight={data.jitterMs != null && data.jitterMs <= 10 ? "good" : "warn"} />
                  <StatCard label="Min / Max Ping" value={`${data.minMs} - ${data.maxMs} ms`} />
                  <StatCard label="Rớt gói (Packet Loss)" value={`${data.lossPercent}%`} highlight={data.lossPercent === 0 ? "good" : "bad"} />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
