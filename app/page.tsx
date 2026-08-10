"use client";

import { useState } from "react";
import type { ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TopTabBar, { type TabId } from "@/components/TopTabBar";
import SpeedTestPanel from "@/components/SpeedTestPanel";
import NetworkInfoPanel from "@/components/NetworkInfoPanel";
import WifiScanPanel from "@/components/WifiScanPanel";
import OptimizePanel from "@/components/OptimizePanel";
import HistoryPanel from "@/components/HistoryPanel";
import DnsPingPanel from "@/components/DnsPingPanel";
import DnsBenchmarkPanel from "@/components/DnsBenchmarkPanel";
import WifiHeatmapPanel from "@/components/WifiHeatmapPanel";

const PANELS: Record<TabId, ComponentType> = {
  speed: SpeedTestPanel,
  system: NetworkInfoPanel,
  wifi: WifiScanPanel,
  optimize: OptimizePanel,
  history: HistoryPanel,
  dns_ping: DnsPingPanel,
  dns_bench: DnsBenchmarkPanel,
  heatmap: WifiHeatmapPanel,
};

export default function Dashboard() {
  const [tab, setTab] = useState<TabId>("speed");
  const ActivePanel = PANELS[tab];

  return (
    <div className="min-h-screen bg-ink text-white font-display">
      <TopTabBar active={tab} onChange={setTab} />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Chuyển tab mượt bằng crossfade + trượt nhẹ (easing kiểu Apple) thay
            vì đổi nội dung tức thời. */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <ActivePanel />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
