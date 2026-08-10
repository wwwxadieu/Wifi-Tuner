"use client";

import { useEffect, useState } from "react";
import { Sparkles, Zap, CheckCircle2, PackageCheck, RefreshCw, AlertCircle } from "lucide-react";

interface UpdateState {
  status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "not-available" | "error";
  version?: string;
  isDifferential?: boolean;
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
  error?: string;
}

declare global {
  interface Window {
    wifituner?: {
      platform: string;
      isElectron: boolean;
      openExternal: (url: string) => Promise<boolean>;
      checkForUpdates: () => Promise<any>;
      downloadUpdate: () => Promise<boolean>;
      quitAndInstall: () => void;
      onUpdateStatus: (callback: (data: UpdateState) => void) => () => void;
    };
  }
}

export default function UpdateNotifier() {
  const [updateState, setUpdateState] = useState<UpdateState>({ status: "idle" });
  const [currentVersion, setCurrentVersion] = useState("0.1.0");

  useEffect(() => {
    if (typeof window !== "undefined" && window.wifituner?.onUpdateStatus) {
      const cleanup = window.wifituner.onUpdateStatus((data) => {
        setUpdateState(data);
      });
      return cleanup;
    } else {
      fetch("/api/updater")
        .then((res) => res.json())
        .then((data) => {
          if (data.currentVersion) setCurrentVersion(data.currentVersion);
          if (data.isUpdateAvailable) {
            setUpdateState({
              status: "available",
              version: data.latestVersion,
              isDifferential: true,
            });
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleCheck = () => {
    setUpdateState({ status: "checking" });
    if (window.wifituner?.checkForUpdates) {
      window.wifituner.checkForUpdates().catch(() => {
        setUpdateState({ status: "error", error: "Không thể kiểm tra bản cập nhật" });
      });
    } else {
      fetch("/api/updater")
        .then((res) => res.json())
        .then((data) => {
          if (data.isUpdateAvailable) {
            setUpdateState({ status: "available", version: data.latestVersion, isDifferential: true });
          } else {
            setUpdateState({ status: "not-available" });
            setTimeout(() => setUpdateState({ status: "idle" }), 4000);
          }
        })
        .catch(() => setUpdateState({ status: "error", error: "Lỗi kết nối máy chủ" }));
    }
  };

  const handleInstall = () => {
    if (window.wifituner?.quitAndInstall) {
      window.wifituner.quitAndInstall();
    } else {
      window.open("https://github.com/wwwxadieu/Wifi-Tuner/releases/latest", "_blank");
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Current Version Badge */}
      <div className="flex items-center gap-2 rounded-full border border-hair bg-white/5 px-3 py-1 text-xs text-white/70">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>v{currentVersion}</span>
      </div>

      {/* Status Notifications */}
      {updateState.status === "checking" && (
        <span className="flex items-center gap-1.5 text-xs text-white/50 animate-pulse">
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-cyan-400" />
          <span>Đang kiểm tra bản cập nhật…</span>
        </span>
      )}

      {updateState.status === "not-available" && (
        <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Đã ở phiên bản mới nhất</span>
        </span>
      )}

      {updateState.status === "available" && (
        <div className="flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs text-white">
          <span>Có bản mới <b>v{updateState.version}</b></span>
          <span className={`flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold text-[10px] ${
            updateState.isDifferential ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
          }`}>
            {updateState.isDifferential ? <Zap className="h-3 w-3" /> : <PackageCheck className="h-3 w-3" />}
            {updateState.isDifferential ? "Bản vá nhanh" : "Bản cập nhật lớn"}
          </span>
        </div>
      )}

      {updateState.status === "downloading" && (
        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
          <span>Đang tải {updateState.percent}%</span>
          {updateState.bytesPerSecond && (
            <span className="text-white/50 text-[10px]">({Math.round(updateState.bytesPerSecond / 1024)} KB/s)</span>
          )}
          <div className="h-1.5 w-16 bg-black/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 rounded-full transition-all duration-300"
              style={{ width: `${updateState.percent || 0}%` }}
            />
          </div>
        </div>
      )}

      {updateState.status === "downloaded" && (
        <button
          onClick={handleInstall}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg transition hover:scale-105 active:scale-95"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Cài đặt & Khởi động lại</span>
        </button>
      )}

      {/* Manual Check Button */}
      {(updateState.status === "idle" || updateState.status === "error") && (
        <button
          onClick={handleCheck}
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/90 transition underline underline-offset-4"
        >
          {updateState.status === "error" && <AlertCircle className="h-3.5 w-3.5 text-rose-400" />}
          <span>Kiểm tra bản cập nhật</span>
        </button>
      )}
    </div>
  );
}
