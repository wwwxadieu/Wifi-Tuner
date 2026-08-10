interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: "accent" | "accent2" | "good" | "warn" | "bad" | "download" | "upload";
  loading?: boolean;
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

export default function StatCard({ label, value, sub, highlight, loading }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]">
      <div className="text-xs uppercase tracking-wide text-white/40">{label}</div>
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
