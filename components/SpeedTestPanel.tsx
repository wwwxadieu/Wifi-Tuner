"use client";

import { useEffect, useState } from "react";
import SpeedTest, { type MeasurementSummary } from "@cloudflare/speedtest";
import StatCard from "./StatCard";

type Status = "idle" | "running" | "done" | "error";

interface HistoryEntry {
  at: string;
  download: number | null;
  upload: number | null;
  latency: number | null;
  jitter: number | null;
}

const HISTORY_KEY = "wifituner:speed-history";
const HISTORY_LIMIT = 20;

function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(-HISTORY_LIMIT)));
  } catch {
    // Bỏ qua nếu localStorage đầy hoặc bị chặn (ví dụ chế độ duyệt ẩn danh).
  }
}

function toMbps(bps: number | undefined): number | null {
  return typeof bps === "number" ? Math.round((bps / 1_000_000) * 10) / 10 : null;
}

function fmt(value: number | null | undefined, unit: string) {
  return value === null || value === undefined ? "—" : `${value}${unit}`;
}

export default function SpeedTestPanel() {
  const [status, setStatus] = useState<Status>("idle");
  const [summary, setSummary] = useState<MeasurementSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  function start() {
    setStatus("running");
    setError(null);
    setSummary(null);

    const engine = new SpeedTest();
    engine.onResultsChange = () => setSummary(engine.results.getSummary());
    engine.onFinish = (results) => {
      const finalSummary = results.getSummary();
      setSummary(finalSummary);
      setStatus("done");

      const entry: HistoryEntry = {
        at: new Date().toISOString(),
        download: toMbps(finalSummary.download),
        upload: toMbps(finalSummary.upload),
        latency: finalSummary.latency ?? null,
        jitter: finalSummary.jitter ?? null,
      };
      setHistory((prev) => {
        const next = [...prev, entry].slice(-HISTORY_LIMIT);
        saveHistory(next);
        return next;
      });

      // Synchronize with SQLite Database
      fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          downloadMbps: entry.download,
          uploadMbps: entry.upload,
          latencyMs: entry.latency,
          jitterMs: entry.jitter,
          source: "manual",
        }),
      }).catch(() => {});
    };
    engine.onError = (message) => {
      setError(message);
      setStatus("error");
    };
  }

  const download = toMbps(summary?.download);
  const upload = toMbps(summary?.upload);
  const recentHistory = [...history].reverse().slice(0, 6);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Speed test</h2>
          <p className="text-sm text-white/50">
            Đo tốc độ download/upload, độ trễ và jitter qua hạ tầng đo lường của Cloudflare.
          </p>
        </div>
        <button
          onClick={start}
          disabled={status === "running"}
          className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "running" ? "Đang đo…" : status === "idle" ? "Bắt đầu đo" : "Đo lại"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Download" value={fmt(download, " Mbps")} highlight="accent" loading={status === "running"} />
        <StatCard label="Upload" value={fmt(upload, " Mbps")} highlight="accent2" loading={status === "running"} />
        <StatCard label="Độ trễ (ping)" value={fmt(summary?.latency ?? null, " ms")} loading={status === "running"} />
        <StatCard label="Jitter" value={fmt(summary?.jitter ?? null, " ms")} loading={status === "running"} />
      </div>

      {recentHistory.length > 0 && (
        <div className="rounded-2xl border border-hair bg-panel p-4">
          <h3 className="mb-3 text-sm font-medium text-white/70">Lịch sử gần đây</h3>
          <div className="space-y-2 text-sm">
            {recentHistory.map((entry) => (
              <div key={entry.at} className="flex items-center justify-between text-white/60">
                <span className="text-white/40">
                  {new Date(entry.at).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                </span>
                <span>↓ {fmt(entry.download, " Mbps")}</span>
                <span>↑ {fmt(entry.upload, " Mbps")}</span>
                <span>{fmt(entry.latency, " ms")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
