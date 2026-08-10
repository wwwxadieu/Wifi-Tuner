"use client";

import { useState } from "react";
import TabNav, { type TabId } from "@/components/TabNav";
import SpeedTestPanel from "@/components/SpeedTestPanel";
import NetworkInfoPanel from "@/components/NetworkInfoPanel";
import WifiScanPanel from "@/components/WifiScanPanel";
import OptimizePanel from "@/components/OptimizePanel";
import HistoryPanel from "@/components/HistoryPanel";

export default function Dashboard() {
  const [tab, setTab] = useState<TabId>("speed");

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WiFi Tuner</h1>
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
      </section>
    </main>
  );
}
