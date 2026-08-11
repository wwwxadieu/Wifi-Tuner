"use client";

import { TrendingUp } from "lucide-react";
import type { SpeedHistoryRecord } from "@/lib/db";

interface HistoryTrendChartProps {
  records: SpeedHistoryRecord[];
}

const WIDTH = 600;
const HEIGHT = 160;

// Biểu đồ xu hướng tốc độ theo THỜI GIAN THỰC (trục X tỉ lệ theo createdAt
// thật của từng lần đo, không phải theo thứ tự index) — dùng lại đúng kỹ
// thuật vẽ SVG path thủ công của RealtimeSpeedChart.tsx (gradient area +
// stroke path) thay vì thêm thư viện biểu đồ mới, giữ đúng triết lý ít phụ
// thuộc của project.
export default function HistoryTrendChart({ records }: HistoryTrendChartProps) {
  // API trả về mới nhất trước (DESC) — đảo lại thành thứ tự thời gian tăng
  // dần (cũ -> mới) để vẽ trái sang phải đúng chiều thời gian.
  const chronological = [...records].reverse();

  if (chronological.length < 2) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-2xl border border-hair bg-panel/50 text-xs text-white/30">
        Cần ít nhất 2 lần đo để vẽ biểu đồ xu hướng theo thời gian.
      </div>
    );
  }

  const times = chronological.map((r) => new Date(r.createdAt).getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeSpan = maxTime - minTime || 1;

  const maxVal = Math.max(...chronological.flatMap((r) => [r.downloadMbps || 0, r.uploadMbps || 0]), 10);

  const pointsToPath = (key: "downloadMbps" | "uploadMbps") => {
    return chronological
      .map((r, idx) => {
        const t = new Date(r.createdAt).getTime();
        const x = ((t - minTime) / timeSpan) * WIDTH;
        const y = HEIGHT - ((r[key] || 0) / maxVal) * (HEIGHT - 20);
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const dlPath = pointsToPath("downloadMbps");
  const ulPath = pointsToPath("uploadMbps");
  const dlAreaPath = `${dlPath} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`;
  const ulAreaPath = `${ulPath} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`;

  const formatDate = (ms: number) =>
    new Date(ms).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

  return (
    <div className="relative overflow-hidden rounded-2xl border border-hair bg-panel p-5 space-y-3 shadow-xl">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent2" />
          <span className="font-semibold text-white/90">Xu hướng tốc độ theo thời gian</span>
        </div>
        <div className="flex items-center gap-4 font-mono">
          <span className="flex items-center gap-1.5 font-bold text-download">
            <span className="h-2.5 w-2.5 rounded-full bg-download shadow-sm shadow-download" />
            Download (Mbps)
          </span>
          <span className="flex items-center gap-1.5 font-bold text-upload">
            <span className="h-2.5 w-2.5 rounded-full bg-upload shadow-sm shadow-upload" />
            Upload (Mbps)
          </span>
        </div>
      </div>

      <div className="relative h-40 w-full">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
          <defs>
            <linearGradient id="trendDlGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#30d158" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#30d158" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="trendUlGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0a84ff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0a84ff" stopOpacity="0" />
            </linearGradient>
          </defs>

          <line x1="0" y1="20" x2={WIDTH} y2="20" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
          <line x1="0" y1="70" x2={WIDTH} y2="70" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
          <line x1="0" y1="120" x2={WIDTH} y2="120" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />

          <path d={dlAreaPath} fill="url(#trendDlGradient)" />
          <path d={dlPath} fill="none" stroke="#30d158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          <path d={ulAreaPath} fill="url(#trendUlGradient)" />
          <path d={ulPath} fill="none" stroke="#0a84ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="flex items-center justify-between text-[11px] text-white/35 font-mono">
        <span>{formatDate(minTime)}</span>
        <span>{chronological.length} lần đo</span>
        <span>{formatDate(maxTime)}</span>
      </div>
    </div>
  );
}
