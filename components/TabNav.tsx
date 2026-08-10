"use client";

import { Gauge, Cpu, Wifi, Zap, History, Gamepad2, SlidersHorizontal, Radio } from "lucide-react";

export type TabId = "speed" | "system" | "wifi" | "optimize" | "history" | "gaming" | "dns_bench" | "heatmap";

interface TabItem {
  id: TabId;
  label: string;
  icon: any;
}

const TABS: TabItem[] = [
  { id: "speed", label: "Tốc độ", icon: Gauge },
  { id: "system", label: "Hệ thống", icon: Cpu },
  { id: "wifi", label: "WiFi lân cận", icon: Wifi },
  { id: "optimize", label: "Tối ưu 1-chạm", icon: Zap },
  { id: "history", label: "Lịch sử & Driver", icon: History },
  { id: "gaming", label: "Gaming Ping", icon: Gamepad2 },
  { id: "dns_bench", label: "DNS Benchmark", icon: SlidersHorizontal },
  { id: "heatmap", label: "Biểu đồ Tín hiệu", icon: Radio },
];

export default function TabNav({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <nav className="flex flex-wrap gap-1 rounded-2xl border border-hair bg-panel p-1.5 shadow-lg">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
              isActive
                ? "bg-indigo-600/90 text-white shadow-md shadow-indigo-600/20"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-white/50"}`} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
