"use client";

import { motion } from "framer-motion";
import { Gauge, Cpu, Wifi, Zap, History, Signal, SlidersHorizontal, Radio, ShieldCheck } from "lucide-react";
import UpdateNotifier from "./UpdateNotifier";

export type TabId = "speed" | "system" | "wifi" | "optimize" | "history" | "dns_ping" | "dns_bench" | "heatmap";

interface TabItem {
  id: TabId;
  label: string;
  icon: any;
}

const TABS: TabItem[] = [
  { id: "speed", label: "Tốc độ", icon: Gauge },
  { id: "system", label: "Hệ thống", icon: Cpu },
  { id: "wifi", label: "WiFi lân cận", icon: Wifi },
  { id: "optimize", label: "Tối ưu", icon: Zap },
  { id: "history", label: "Lịch sử", icon: History },
  { id: "dns_ping", label: "Ping DNS", icon: Signal },
  { id: "dns_bench", label: "DNS Benchmark", icon: SlidersHorizontal },
  { id: "heatmap", label: "Kênh WiFi", icon: Radio },
];

// Thanh tab ngang kiểu "segmented control" của Apple: kính mờ dính trên đầu
// trang, tab đang chọn có 1 khối nền trượt mượt giữa các tab (framer-motion
// layoutId — shared layout animation, giống hiệu ứng focus của tvOS/iOS).
export default function TopTabBar({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-white/[0.06] backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-accent to-accent2 text-white shadow-lg shadow-accent/30">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="hidden text-sm font-semibold tracking-tight text-white sm:inline">WiFi Tuner</span>
        </div>

        <div className="h-5 w-px shrink-0 bg-white/10" />

        <nav className="no-scrollbar flex items-center gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  isActive ? "text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 rounded-full border border-white/10 bg-white/10"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon className="relative h-3.5 w-3.5 shrink-0" />
                <span className="relative">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="ml-auto shrink-0">
          <UpdateNotifier />
        </div>
      </div>
    </header>
  );
}
