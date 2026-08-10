"use client";

import { Gauge, Cpu, Wifi, Zap, History, Gamepad2, SlidersHorizontal, Radio, ShieldCheck } from "lucide-react";
import UpdateNotifier from "./UpdateNotifier";

export type TabId = "speed" | "system" | "wifi" | "optimize" | "history" | "gaming" | "dns_bench" | "heatmap";

interface TabItem {
  id: TabId;
  label: string;
  sublabel: string;
  icon: any;
}

const TABS: TabItem[] = [
  { id: "speed", label: "Tốc độ Mạng", sublabel: "Speed Test & Chart", icon: Gauge },
  { id: "system", label: "Cấu hình Hệ thống", sublabel: "Adapter & TCP/IP", icon: Cpu },
  { id: "wifi", label: "WiFi lân cận", sublabel: "Scanner & BSSID", icon: Wifi },
  { id: "optimize", label: "Tối ưu 1-chạm", sublabel: "DNS & UAC Tuning", icon: Zap },
  { id: "history", label: "Lịch sử & Driver", sublabel: "SQLite History", icon: History },
  { id: "gaming", label: "Gaming Ping", sublabel: "Packet Loss & Jitter", icon: Gamepad2 },
  { id: "dns_bench", label: "DNS Benchmark", sublabel: "Fast Switcher", icon: SlidersHorizontal },
  { id: "heatmap", label: "Biểu đồ Tín hiệu", sublabel: "Channel Spectrum", icon: Radio },
];

export default function SidebarNav({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <aside className="w-72 shrink-0 border-r border-white/10 bg-slate-950/80 backdrop-blur-2xl p-6 flex flex-col justify-between min-h-screen">
      <div className="space-y-6">
        {/* Branding */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/30">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">WiFi Tuner</h1>
              <span className="text-[11px] text-white/40">Windows Desktop Optimization</span>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-600/90 to-blue-600/90 text-white shadow-lg shadow-indigo-600/25 border border-indigo-500/40"
                    : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-white" : "text-white/40"}`} />
                <div className="flex flex-col">
                  <span className="text-xs font-bold">{tab.label}</span>
                  <span className="text-[10px] text-white/40 font-normal">{tab.sublabel}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Update Notifier */}
      <div className="pt-6 border-t border-white/10">
        <UpdateNotifier />
      </div>
    </aside>
  );
}
