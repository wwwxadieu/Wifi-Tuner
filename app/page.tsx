"use client";

import { useState } from "react";
import SidebarNav, { type TabId } from "@/components/SidebarNav";
import SpeedTestPanel from "@/components/SpeedTestPanel";
import NetworkInfoPanel from "@/components/NetworkInfoPanel";
import WifiScanPanel from "@/components/WifiScanPanel";
import OptimizePanel from "@/components/OptimizePanel";
import HistoryPanel from "@/components/HistoryPanel";
import DnsPingPanel from "@/components/DnsPingPanel";
import DnsBenchmarkPanel from "@/components/DnsBenchmarkPanel";
import WifiHeatmapPanel from "@/components/WifiHeatmapPanel";

export default function Dashboard() {
  const [tab, setTab] = useState<TabId>("speed");

  return (
    <div className="flex min-h-screen bg-ink text-white font-display overflow-x-hidden">
      {/* Fixed Left Sidebar Navigation for Desktop Widescreen */}
      <SidebarNav active={tab} onChange={setTab} />

      {/* Main Content Stage */}
      <main className="flex-1 min-w-0 p-8 md:p-10 max-w-7xl overflow-y-auto">
        {tab === "speed" && <SpeedTestPanel />}
        {tab === "system" && <NetworkInfoPanel />}
        {tab === "wifi" && <WifiScanPanel />}
        {tab === "optimize" && <OptimizePanel />}
        {tab === "history" && <HistoryPanel />}
        {tab === "dns_ping" && <DnsPingPanel />}
        {tab === "dns_bench" && <DnsBenchmarkPanel />}
        {tab === "heatmap" && <WifiHeatmapPanel />}
      </main>
    </div>
  );
}
