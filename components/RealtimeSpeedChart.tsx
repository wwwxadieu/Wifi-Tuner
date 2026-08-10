"use client";

import type { SpeedUnit } from "@/lib/types";
import { convertSpeed } from "@/lib/types";

interface SamplePoint {
  time: number;
  downloadBps: number;
  uploadBps: number;
}

interface RealtimeSpeedChartProps {
  samples: SamplePoint[];
  unit: SpeedUnit;
  status: "idle" | "running" | "done" | "error";
  phase: "ping" | "download" | "upload" | "done";
}

export default function RealtimeSpeedChart({ samples, unit, status, phase }: RealtimeSpeedChartProps) {
  if (samples.length < 2 && status === "idle") {
    return (
      <div className="flex h-36 w-full items-center justify-center rounded-2xl border border-hair bg-panel/50 text-xs text-white/30">
        Biểu đồ tốc độ thời gian thực sẽ hiển thị khi bạn bắt đầu đo…
      </div>
    );
  }

  const convertedSamples = samples.map((s) => ({
    time: s.time,
    download: convertSpeed(s.downloadBps, unit) || 0,
    upload: convertSpeed(s.uploadBps, unit) || 0,
  }));

  const maxVal = Math.max(
    ...convertedSamples.map((s) => Math.max(s.download, s.upload)),
    10
  );

  const height = 120;
  const width = 600;

  const pointsToPath = (key: "download" | "upload") => {
    if (convertedSamples.length === 0) return "";
    return convertedSamples
      .map((s, idx) => {
        const x = (idx / Math.max(1, convertedSamples.length - 1)) * width;
        const y = height - (s[key] / maxVal) * (height - 20);
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const dlPath = pointsToPath("download");
  const ulPath = pointsToPath("upload");

  return (
    <div className="relative overflow-hidden rounded-2xl border border-hair bg-panel p-4 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-white/80">Biểu đồ tốc độ thời gian thực</span>
          <div className="flex items-center gap-3 font-mono">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="h-2 w-2 rounded-full bg-cyan-400" /> Download ({unit})
            </span>
            <span className="flex items-center gap-1.5 text-indigo-400">
              <span className="h-2 w-2 rounded-full bg-indigo-400" /> Upload ({unit})
            </span>
          </div>
        </div>

        {status === "running" && (
          <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300 animate-pulse">
            {phase === "ping" ? "Đang đo Ping..." : phase === "download" ? "Đang đo Download..." : phase === "upload" ? "Đang đo Upload..." : "Đang xử lý..."}
          </span>
        )}
      </div>

      <div className="relative h-32 w-full">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
          {/* Horizontal grid lines */}
          <line x1="0" y1="20" x2={width} y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <line x1="0" y1="60" x2={width} y2="60" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <line x1="0" y1="100" x2={width} y2="100" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />

          {/* Download Path */}
          {dlPath && (
            <path
              d={dlPath}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          )}

          {/* Upload Path */}
          {ulPath && (
            <path
              d={ulPath}
              fill="none"
              stroke="#818cf8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
