"use client";

import { useEffect, useState } from "react";
import SpeedTest, { type MeasurementSummary } from "@cloudflare/speedtest";
import StatCard from "./StatCard";
import RealtimeSpeedChart from "./RealtimeSpeedChart";
import { SPEED_SERVERS, runFallbackSpeedProbe } from "@/lib/speedProbe";
import type { SpeedServerRegion, SpeedUnit } from "@/lib/types";
import { formatSpeed } from "@/lib/types";

type Status = "idle" | "running" | "done" | "error";
type Phase = "ping" | "download" | "upload" | "done";

interface HistoryEntry {
  at: string;
  downloadBps: number | null;
  uploadBps: number | null;
  latency: number | null;
  jitter: number | null;
}

interface SamplePoint {
  time: number;
  downloadBps: number;
  uploadBps: number;
}

const HISTORY_KEY = "wifituner:speed-history-v2";
const UNIT_KEY = "wifituner:speed-unit";
const REGION_KEY = "wifituner:speed-region";
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
  } catch {}
}

export default function SpeedTestPanel() {
  const [status, setStatus] = useState<Status>("idle");
  const [phase, setPhase] = useState<Phase>("ping");
  const [unit, setUnit] = useState<SpeedUnit>("Mbps");
  const [region, setRegion] = useState<SpeedServerRegion>("auto");
  const [error, setError] = useState<string | null>(null);

  // Live measurements
  const [downloadBps, setDownloadBps] = useState<number | null>(null);
  const [uploadBps, setUploadBps] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [jitter, setJitter] = useState<number | null>(null);

  const [samples, setSamples] = useState<SamplePoint[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    const savedUnit = localStorage.getItem(UNIT_KEY) as SpeedUnit;
    if (savedUnit && ["Mbps", "MB/s", "Kbps"].includes(savedUnit)) setUnit(savedUnit);
    const savedRegion = localStorage.getItem(REGION_KEY) as SpeedServerRegion;
    if (savedRegion) setRegion(savedRegion);
  }, []);

  const handleUnitChange = (newUnit: SpeedUnit) => {
    setUnit(newUnit);
    localStorage.setItem(UNIT_KEY, newUnit);
  };

  const handleRegionChange = (newRegion: SpeedServerRegion) => {
    setRegion(newRegion);
    localStorage.setItem(REGION_KEY, newRegion);
  };

  const saveResultToHistory = (dl: number | null, ul: number | null, lat: number | null, jit: number | null) => {
    const entry: HistoryEntry = {
      at: new Date().toISOString(),
      downloadBps: dl,
      uploadBps: ul,
      latency: lat,
      jitter: jit,
    };

    setHistory((prev) => {
      const next = [...prev, entry].slice(-HISTORY_LIMIT);
      saveHistory(next);
      return next;
    });

    // Save to SQLite
    fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        downloadMbps: dl ? Math.round((dl / 1_000_000) * 10) / 10 : null,
        uploadMbps: ul ? Math.round((ul / 1_000_000) * 10) / 10 : null,
        latencyMs: lat,
        jitterMs: jit,
        source: "manual",
      }),
    }).catch(() => {});
  };

  const startFallbackTest = async () => {
    try {
      const startTime = Date.now();
      const res = await runFallbackSpeedProbe(region, (prog) => {
        setPhase(prog.phase);
        if (prog.downloadBps !== undefined) setDownloadBps(prog.downloadBps);
        if (prog.uploadBps !== undefined) setUploadBps(prog.uploadBps);
        if (prog.latencyMs !== undefined) setLatency(prog.latencyMs);
        if (prog.jitterMs !== undefined) setJitter(prog.jitterMs);

        setSamples((prev) => [
          ...prev,
          {
            time: (Date.now() - startTime) / 1000,
            downloadBps: prog.downloadBps || 0,
            uploadBps: prog.uploadBps || 0,
          },
        ]);
      });

      setDownloadBps(res.downloadBps);
      setUploadBps(res.uploadBps);
      setLatency(res.latencyMs);
      setJitter(res.jitterMs);
      setStatus("done");
      setPhase("done");
      saveResultToHistory(res.downloadBps, res.uploadBps, res.latencyMs, res.jitterMs);
    } catch (err: any) {
      setError(err.message || "Lỗi đo tốc độ qua máy chủ fallback.");
      setStatus("error");
    }
  };

  const start = () => {
    setStatus("running");
    setPhase("ping");
    setError(null);
    setDownloadBps(null);
    setUploadBps(null);
    setLatency(null);
    setJitter(null);
    setSamples([]);

    if (region !== "auto") {
      // Use Regional Fallback Probe
      startFallbackTest();
      return;
    }

    // Try Cloudflare Engine first
    try {
      const startTime = Date.now();
      const engine = new SpeedTest();

      engine.onResultsChange = () => {
        const sum = engine.results.getSummary();
        if (sum.download) setDownloadBps(sum.download);
        if (sum.upload) setUploadBps(sum.upload);
        if (sum.latency) setLatency(sum.latency);
        if (sum.jitter) setJitter(sum.jitter);

        if (sum.download && !sum.upload) setPhase("download");
        else if (sum.upload) setPhase("upload");

        setSamples((prev) => [
          ...prev,
          {
            time: (Date.now() - startTime) / 1000,
            downloadBps: sum.download || 0,
            uploadBps: sum.upload || 0,
          },
        ]);
      };

      engine.onFinish = (results) => {
        const sum = results.getSummary();
        setDownloadBps(sum.download ?? null);
        setUploadBps(sum.upload ?? null);
        setLatency(sum.latency ?? null);
        setJitter(sum.jitter ?? null);
        setStatus("done");
        setPhase("done");

        saveResultToHistory(sum.download ?? null, sum.upload ?? null, sum.latency ?? null, sum.jitter ?? null);
      };

      engine.onError = (msg) => {
        console.warn("Cloudflare engine error, switching to HTTP Fallback Probe:", msg);
        // Switch automatically to Fallback Probe
        startFallbackTest();
      };
    } catch {
      startFallbackTest();
    }
  };

  const recentHistory = [...history].reverse().slice(0, 6);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Speed Test Tốc Độ Mạng</h2>
          <p className="text-sm text-white/50">
            Đo tốc độ download/upload, độ trễ và jitter với biểu đồ thời gian thực.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Unit Selector */}
          <div className="flex items-center gap-1 rounded-full border border-hair bg-panel p-1 text-xs">
            {(["Mbps", "MB/s", "Kbps"] as SpeedUnit[]).map((u) => (
              <button
                key={u}
                onClick={() => handleUnitChange(u)}
                className={`rounded-full px-3 py-1 font-semibold transition ${
                  unit === u ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                {u}
              </button>
            ))}
          </div>

          <button
            onClick={start}
            disabled={status === "running"}
            className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "running" ? "Đang đo…" : status === "idle" ? "Bắt đầu đo" : "Đo lại"}
          </button>
        </div>
      </div>

      {/* Region / Server Selector */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-hair bg-panel p-3">
        <span className="text-xs font-semibold text-white/60 mr-2">Máy chủ đo:</span>
        {SPEED_SERVERS.map((srv) => (
          <button
            key={srv.id}
            onClick={() => handleRegionChange(srv.id)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              region === srv.id
                ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                : "border-hair bg-black/20 text-white/60 hover:text-white hover:border-white/20"
            }`}
          >
            <span>{srv.flag}</span>
            <span>{srv.name}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={start} className="underline text-xs hover:text-white">Thử lại</button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label={`Download (${unit})`}
          value={formatSpeed(downloadBps, unit)}
          highlight="accent"
          loading={status === "running" && phase === "download"}
        />
        <StatCard
          label={`Upload (${unit})`}
          value={formatSpeed(uploadBps, unit)}
          highlight="accent2"
          loading={status === "running" && phase === "upload"}
        />
        <StatCard
          label="Độ trễ (ping)"
          value={latency !== null ? `${latency} ms` : "—"}
          loading={status === "running" && phase === "ping"}
        />
        <StatCard
          label="Jitter"
          value={jitter !== null ? `${jitter} ms` : "—"}
          loading={status === "running" && phase === "ping"}
        />
      </div>

      {/* Realtime Speed Waveform Chart */}
      <RealtimeSpeedChart samples={samples} unit={unit} status={status} phase={phase} />

      {/* Recent History Table */}
      {recentHistory.length > 0 && (
        <div className="rounded-2xl border border-hair bg-panel p-4">
          <h3 className="mb-3 text-sm font-medium text-white/70">Lịch sử đo gần đây ({unit})</h3>
          <div className="space-y-2 text-sm">
            {recentHistory.map((entry) => (
              <div key={entry.at} className="flex items-center justify-between text-white/60 border-b border-hair/40 pb-1.5 last:border-0">
                <span className="text-white/40 font-mono text-xs">
                  {new Date(entry.at).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                </span>
                <span className="text-cyan-400 font-medium">↓ {formatSpeed(entry.downloadBps, unit)}</span>
                <span className="text-indigo-400 font-medium">↑ {formatSpeed(entry.uploadBps, unit)}</span>
                <span className="text-white/80">{entry.latency !== null ? `${entry.latency} ms` : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
