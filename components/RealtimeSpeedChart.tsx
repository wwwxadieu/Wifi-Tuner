"use client";

import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
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
  testType?: "all" | "download" | "upload";
}

export default function RealtimeSpeedChart({ samples, unit, status, phase, testType = "all" }: RealtimeSpeedChartProps) {
  if (samples.length < 2 && status === "idle") {
    return (
      <div className="flex h-36 w-full items-center justify-center rounded-2xl border border-hair bg-panel/50 text-xs text-white/30">
        Biểu đồ tốc độ thời gian thực sẽ hiển thị khi bạn bắt đầu bài đo…
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

  // Create area fill paths (closing down to zero line)
  const dlAreaPath = dlPath ? `${dlPath} L ${width} ${height} L 0 ${height} Z` : "";
  const ulAreaPath = ulPath ? `${ulPath} L ${width} ${height} L 0 ${height} Z` : "";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-hair bg-panel p-5 space-y-3 shadow-xl">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-white/90">Biểu đồ tốc độ thời gian thực (Gradient)</span>
          <div className="flex items-center gap-4 font-mono">
            {(testType === "all" || testType === "download") && (
              <span className="flex items-center gap-1.5 font-bold text-download">
                <span className="h-2.5 w-2.5 rounded-full bg-download shadow-sm shadow-download" />
                Download ({unit})
              </span>
            )}
            {(testType === "all" || testType === "upload") && (
              <span className="flex items-center gap-1.5 font-bold text-upload">
                <span className="h-2.5 w-2.5 rounded-full bg-upload shadow-sm shadow-upload" />
                Upload ({unit})
              </span>
            )}
          </div>
        </div>

        {status === "running" && (
          <span className="flex items-center gap-1.5 rounded-full bg-accent/20 border border-accent/40 px-3 py-1 text-xs font-bold text-accent">
            {phase === "ping" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Đang kiểm tra Ping...</span>
              </>
            ) : phase === "download" ? (
              <>
                <ArrowDown className="h-3.5 w-3.5 text-download" />
                <span>Đang đo Download...</span>
              </>
            ) : phase === "upload" ? (
              <>
                <ArrowUp className="h-3.5 w-3.5 text-upload" />
                <span>Đang đo Upload...</span>
              </>
            ) : (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Đang xử lý...</span>
              </>
            )}
          </span>
        )}
      </div>

      <div className="relative h-36 w-full">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
          <defs>
            {/* SF Green — Download */}
            <linearGradient id="dlGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#30d158" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#30d158" stopOpacity="0.0" />
            </linearGradient>

            {/* SF Blue — Upload */}
            <linearGradient id="ulGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0a84ff" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#0a84ff" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="0" y1="20" x2={width} y2="20" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
          <line x1="0" y1="60" x2={width} y2="60" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
          <line x1="0" y1="100" x2={width} y2="100" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />

          {/* Download Area & Path */}
          {(testType === "all" || testType === "download") && dlAreaPath && (
            <path d={dlAreaPath} fill="url(#dlGradient)" className="transition-all duration-300" />
          )}
          {(testType === "all" || testType === "download") && dlPath && (
            <path
              d={dlPath}
              fill="none"
              stroke="#30d158"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300 filter drop-shadow-[0_0_8px_rgba(48,209,88,0.5)]"
            />
          )}

          {/* Upload Area & Path */}
          {(testType === "all" || testType === "upload") && ulAreaPath && (
            <path d={ulAreaPath} fill="url(#ulGradient)" className="transition-all duration-300" />
          )}
          {(testType === "all" || testType === "upload") && ulPath && (
            <path
              d={ulPath}
              fill="none"
              stroke="#0a84ff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300 filter drop-shadow-[0_0_8px_rgba(10,132,255,0.5)]"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
