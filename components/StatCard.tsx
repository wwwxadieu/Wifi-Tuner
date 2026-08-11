import type { ComponentType } from "react";
import { motion } from "framer-motion";

type IconMotion = "pulse" | "bounce-down" | "bounce-up";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: "accent" | "accent2" | "good" | "warn" | "bad" | "download" | "upload";
  loading?: boolean;
  icon?: ComponentType<{ className?: string }>;
  iconMotion?: IconMotion;
}

const HIGHLIGHT_CLASS: Record<NonNullable<StatCardProps["highlight"]>, string> = {
  accent: "text-accent",
  accent2: "text-accent2",
  good: "text-good",
  warn: "text-warn",
  bad: "text-bad",
  download: "text-download font-semibold",
  upload: "text-upload font-semibold",
};

// Icon nhấp nháy/di chuyển nhẹ khi đang đo (loading) — bounce-down cho
// download (dữ liệu "rơi" xuống), bounce-up cho upload (dữ liệu "đẩy" lên),
// pulse cho các trường hợp còn lại không có hướng cụ thể.
const MOTION_ANIMATE: Record<IconMotion, Record<string, number[]>> = {
  pulse: { scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] },
  "bounce-down": { y: [0, 4, 0] },
  "bounce-up": { y: [0, -4, 0] },
};

export default function StatCard({ label, value, sub, highlight, loading, icon: Icon, iconMotion = "pulse" }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-white/40">
        {Icon && (
          <motion.span
            className={`inline-flex ${highlight ? HIGHLIGHT_CLASS[highlight] : ""}`}
            animate={loading ? MOTION_ANIMATE[iconMotion] : { y: 0, scale: 1, opacity: 1 }}
            transition={loading ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
          >
            <Icon className="h-3.5 w-3.5" />
          </motion.span>
        )}
        <span>{label}</span>
      </div>
      <div
        className={`mt-2 text-2xl font-semibold ${highlight ? HIGHLIGHT_CLASS[highlight] : "text-white"} ${
          loading ? "animate-pulse2" : ""
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-white/40">{sub}</div>}
    </div>
  );
}
