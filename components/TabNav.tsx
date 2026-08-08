"use client";

export type TabId = "speed" | "system" | "wifi";

const TABS: { id: TabId; label: string }[] = [
  { id: "speed", label: "Tốc độ" },
  { id: "system", label: "Hệ thống" },
  { id: "wifi", label: "WiFi lân cận" },
];

export default function TabNav({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <nav className="flex gap-1 rounded-full border border-hair bg-panel p-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            active === tab.id ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
