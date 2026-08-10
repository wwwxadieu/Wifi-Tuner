"use client";

import { useEffect, useState } from "react";
import SpeedTest from "@cloudflare/speedtest";
import { ArrowDown, ArrowUp, Zap, Play, RefreshCw, AlertCircle, Globe } from "lucide-react";
import StatCard from "./StatCard";
import RealtimeSpeedChart from "./RealtimeSpeedChart";
import { SPEED_SERVERS, runDetailedDownloadTest, runDetailedUploadTest, runFallbackSpeedProbe } from "@/lib/speedProbe";
import type { SpeedServerRegion, SpeedUnit } from "@/lib/types";
import { formatSpeed } from "@/lib/types";

type Status = "idle" | "running" | "done" | "error";
type Phase = "ping" | "download" | "upload" | "done";
type TestType = "all" | "download" | "upload";

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

const HISTORY_KEY = "wifituner:speed-history-v3";
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
  const [testType, setTestType] = useState<TestType>("all");
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

  const startTest = async (type: TestType) => {
    setTestType(type);
    setStatus("running");
    setPhase("ping");
    setError(null);
    if (type === "all" || type === "download") setDownloadBps(null);
    if (type === "all" || type === "upload") setUploadBps(null);
    setLatency(null);
    setJitter(null);
    setSamples([]);

    const startTime = Date.now();

    try {
      if (type === "download") {
        const dlRes = await runDetailedDownloadTest(region, (p) => {
          setPhase(p.phase);
          if (p.downloadBps !== undefined) setDownloadBps(p.downloadBps);
          if (p.latencyMs !== undefined) setLatency(p.latencyMs);
          if (p.jitterMs !== undefined) setJitter(p.jitterMs);

          setSamples((prev) => [
            ...prev,
            { time: (Date.now() - startTime) / 1000, downloadBps: p.downloadBps || 0, uploadBps: 0 },
          ]);
        });
        setDownloadBps(dlRes.downloadBps);
        setLatency(dlRes.latencyMs);
        setJitter(dlRes.jitterMs);
        setStatus("done");
        saveResultToHistory(dlRes.downloadBps, null, dlRes.latencyMs, dlRes.jitterMs);
      } else if (type === "upload") {
        const ulRes = await runDetailedUploadTest(region, (p) => {
          setPhase(p.phase);
          if (p.uploadBps !== undefined) setUploadBps(p.uploadBps);
          if (p.latencyMs !== undefined) setLatency(p.latencyMs);
          if (p.jitterMs !== undefined) setJitter(p.jitterMs);

          setSamples((prev) => [
            ...prev,
            { time: (Date.now() - startTime) / 1000, downloadBps: 0, uploadBps: p.uploadBps || 0 },
          ]);
        });
        setUploadBps(ulRes.uploadBps);
        setLatency(ulRes.latencyMs);
        setJitter(ulRes.jitterMs);
        setStatus("done");
        saveResultToHistory(null, ulRes.uploadBps, ulRes.latencyMs, ulRes.jitterMs);
      } else {
        // Full Sequential Test
        const res = await runFallbackSpeedProbe(region, (p) => {
          setPhase(p.phase);
          if (p.downloadBps !== undefined) setDownloadBps(p.downloadBps);
          if (p.uploadBps !== undefined) setUploadBps(p.uploadBps);
          if (p.latencyMs !== undefined) setLatency(p.latencyMs);
          if (p.jitterMs !== undefined) setJitter(p.jitterMs);

          setSamples((prev) => [
            ...prev,
            { time: (Date.now() - startTime) / 1000, downloadBps: p.downloadBps || 0, uploadBps: p.uploadBps || 0 },
          ]);
        });
        setDownloadBps(res.downloadBps);
        setUploadBps(res.uploadBps);
        setLatency(res.latencyMs);
        setJitter(res.jitterMs);
        setStatus("done");
        saveResultToHistory(res.downloadBps, res.uploadBps, res.latencyMs, res.jitterMs);
      }
    } catch (err: any) {
      setError(err.message || "Lỗi đo tốc độ.");
      setStatus("error");
    }
  };

  const recentHistory = [...history].reverse().slice(0, 6);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Speed Test Tốc Độ Mạng</h2>
          <p className="text-sm text-white/50">
            Tách riêng bài đo Download & Upload chuyên sâu với biểu đồ thời gian thực.
          </p>
        </div>

        {/* Unit Selector */}
        <div className="flex items-center gap-1 rounded-full border border-hair bg-panel p-1.5 text-xs">
          <span className="text-white/40 px-2 font-medium">Đơn vị:</span>
          {(["Mbps", "MB/s", "Kbps"] as SpeedUnit[]).map((u) => (
            <button
              key={u}
              onClick={() => handleUnitChange(u)}
              className={`rounded-full px-3.5 py-1 font-bold transition ${
                unit === u ? "bg-indigo-600 text-white shadow-md" : "text-white/50 hover:text-white"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* 3 Separate Test Action Buttons */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Download Test Button (Green) */}
        <button
          onClick={() => startTest("download")}
          disabled={status === "running"}
          className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-600/90 to-teal-600/90 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          <ArrowDown className="h-4 w-4" />
          <span>🟩 Đo Download (6 giây)</span>
        </button>

        {/* Upload Test Button (Red) */}
        <button
          onClick={() => startTest("upload")}
          disabled={status === "running"}
          className="flex items-center justify-center gap-2 rounded-2xl border border-rose-500/40 bg-gradient-to-r from-rose-600/90 to-pink-600/90 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-600/20 transition hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          <ArrowUp className="h-4 w-4" />
          <span>🟥 Đo Upload (6 giây)</span>
        </button>

        {/* Full Test Button (Blue/Indigo) */}
        <button
          onClick={() => startTest("all")}
          disabled={status === "running"}
          className="flex items-center justify-center gap-2 rounded-2xl border border-indigo-500/40 bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          <Zap className="h-4 w-4 fill-current" />
          <span>🚀 Đo Toàn Diện (Full)</span>
        </button>
      </div>

      {/* Region / Server Selector */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-hair bg-panel p-4">
        <span className="text-xs font-semibold text-white/60 mr-2 flex items-center gap-1.5">
          <Globe className="h-4 w-4 text-cyan-400" />
          <span>Máy chủ đo:</span>
        </span>
        {SPEED_SERVERS.map((srv) => (
          <button
            key={srv.id}
            onClick={() => handleRegionChange(srv.id)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
              region === srv.id
                ? "border-cyan-500 bg-cyan-500/10 text-cyan-300 shadow-md"
                : "border-hair bg-black/20 text-white/60 hover:text-white hover:border-white/20"
            }`}
          >
            <span>{srv.flag}</span>
            <span>{srv.name}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => startTest("all")} className="underline text-xs hover:text-white">Thử lại</button>
        </div>
      )}

      {/* Stat Cards - Download = Green, Upload = Red */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label={`Download (${unit})`}
          value={formatSpeed(downloadBps, unit)}
          highlight="download"
          loading={status === "running" && phase === "download"}
        />
        <StatCard
          label={`Upload (${unit})`}
          value={formatSpeed(uploadBps, unit)}
          highlight="upload"
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
      <RealtimeSpeedChart samples={samples} unit={unit} status={status} phase={phase} testType={testType} />

      {/* Recent History Table */}
      {recentHistory.length > 0 && (
        <div className="rounded-2xl border border-hair bg-panel p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white/80">Lịch sử đo gần đây ({unit})</h3>
          <div className="space-y-2 text-sm">
            {recentHistory.map((entry) => (
              <div key={entry.at} className="flex items-center justify-between text-white/60 border-b border-hair/40 pb-2 last:border-0">
                <span className="text-white/40 font-mono text-xs">
                  {new Date(entry.at).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                </span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <ArrowDown className="h-3.5 w-3.5" />
                  {formatSpeed(entry.downloadBps, unit)}
                </span>
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <ArrowUp className="h-3.5 w-3.5" />
                  {formatSpeed(entry.uploadBps, unit)}
                </span>
                <span className="text-white/80">{entry.latency !== null ? `${entry.latency} ms` : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
