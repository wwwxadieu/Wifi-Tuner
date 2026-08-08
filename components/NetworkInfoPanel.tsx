"use client";

import { useEffect, useState } from "react";
import type { NetworkInfo, PingResult } from "@/lib/types";
import StatCard from "./StatCard";

const PUBLIC_DNS = [
  { label: "Cloudflare", host: "1.1.1.1" },
  { label: "Google", host: "8.8.8.8" },
  { label: "Quad9", host: "9.9.9.9" },
];

type DnsProbeState = PingResult | "loading" | "error";

export default function NetworkInfoPanel() {
  const [info, setInfo] = useState<NetworkInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dnsResults, setDnsResults] = useState<Record<string, DnsProbeState>>({});

  useEffect(() => {
    fetch("/api/network-info")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setInfo(data);
      })
      .catch(() => setError("Không thể kết nối tới API"));
  }, []);

  async function compareDns() {
    if (!info) return;
    const targets = info.dns[0]
      ? [{ label: "DNS hiện tại", host: info.dns[0] }, ...PUBLIC_DNS]
      : [...PUBLIC_DNS];

    setDnsResults(Object.fromEntries(targets.map((t) => [t.host, "loading" as const])));
    await Promise.all(
      targets.map(async (t) => {
        try {
          const res = await fetch("/api/ping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ host: t.host }),
          });
          const data = await res.json();
          setDnsResults((prev) => ({ ...prev, [t.host]: res.ok ? (data as PingResult) : "error" }));
        } catch {
          setDnsResults((prev) => ({ ...prev, [t.host]: "error" }));
        }
      })
    );
  }

  if (error) {
    return <div className="rounded-xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">{error}</div>;
  }
  if (!info) {
    return <div className="text-sm text-white/50">Đang đọc cấu hình hệ thống…</div>;
  }

  const dnsTargets = info.dns[0] ? [{ label: "DNS hiện tại", host: info.dns[0] }, ...PUBLIC_DNS] : PUBLIC_DNS;

  return (
    <div className="space-y-8 animate-fade-up">
      {info.platform === "mock" && (
        <div className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          Đang chạy trên môi trường không phải Windows — hiển thị dữ liệu mẫu để minh hoạ giao diện.
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold">Adapter WiFi</h2>
        {info.adapter ? (
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard label="Tên" value={info.adapter.name} />
            <StatCard
              label="Trạng thái"
              value={info.adapter.status}
              highlight={info.adapter.status === "Up" ? "good" : "warn"}
            />
            <StatCard label="Tốc độ liên kết" value={info.adapter.linkSpeed || "—"} />
            <StatCard label="Driver" value={info.adapter.driverVersion || "—"} sub={info.adapter.driverProvider} />
            <StatCard label="Ngày driver" value={info.adapter.driverDate || "—"} />
            <StatCard label="MAC" value={info.adapter.macAddress || "—"} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-white/50">Không tìm thấy adapter WiFi trên máy này.</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">TCP/IP &amp; tiết kiệm điện</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="TCP Auto-Tuning" value={info.tcp?.autoTuningLevel || "—"} />
          <StatCard label="ECN" value={info.tcp?.ecnCapability || "—"} />
          <StatCard
            label="Cho phép tắt card để tiết kiệm điện"
            value={info.power?.allowComputerToTurnOffDevice || "—"}
            highlight={info.power?.allowComputerToTurnOffDevice === "Enabled" ? "warn" : "good"}
          />
        </div>
        <p className="mt-2 text-xs text-white/40">
          Chỉ hiển thị — chỉnh sửa các thông số này (tắt tiết kiệm điện, đổi TCP Auto-Tuning) sẽ có ở bản tối ưu 1-chạm, cần quyền admin.
        </p>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">So sánh độ trễ DNS</h2>
          <button
            onClick={compareDns}
            className="rounded-full border border-hair px-4 py-1.5 text-sm text-white/70 transition hover:bg-white/5"
          >
            Đo thử
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {dnsTargets.map((t) => {
            const r = dnsResults[t.host];
            const value =
              !r ? "—" : r === "loading" ? "…" : r === "error" ? "lỗi" : r.avgMs !== null ? `${r.avgMs} ms` : "timeout";
            return <StatCard key={t.host} label={`${t.label} (${t.host})`} value={value} loading={r === "loading"} />;
          })}
        </div>
      </section>
    </div>
  );
}
