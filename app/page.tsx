"use client";

import { useState } from "react";
import TabNav, { type TabId } from "@/components/TabNav";
import SpeedTestPanel from "@/components/SpeedTestPanel";
import NetworkInfoPanel from "@/components/NetworkInfoPanel";
import WifiScanPanel from "@/components/WifiScanPanel";
import OptimizePanel from "@/components/OptimizePanel";
import HistoryPanel from "@/components/HistoryPanel";
import UpdateNotifier from "@/components/UpdateNotifier";
import GamingPingPanel from "@/components/GamingPingPanel";
import DnsBenchmarkPanel from "@/components/DnsBenchmarkPanel";
import WifiHeatmapPanel from "@/components/WifiHeatmapPanel";

export default function Dashboard() {
  const [tab, setTab] = useState<TabId>("speed");

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">WiFi Tuner</h1>
            <UpdateNotifier />
          </div>
          <p className="text-sm text-white/50">Chẩn đoán và tối ưu tốc độ WiFi cho Windows</p>
        </div>
        <TabNav active={tab} onChange={setTab} />
      </header>

      <section>
        {tab === "speed" && <SpeedTestPanel />}
        {tab === "system" && <NetworkInfoPanel />}
        {tab === "wifi" && <WifiScanPanel />}
        {tab === "optimize" && <OptimizePanel />}
        {tab === "history" && <HistoryPanel />}
        {tab === "gaming" && <GamingPingPanel />}
        {tab === "dns_bench" && <DnsBenchmarkPanel />}
        {tab === "heatmap" && <WifiHeatmapPanel />}
      </section>
    </main>
  );
}
