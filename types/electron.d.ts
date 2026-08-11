export interface UpdateState {
  status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "not-available" | "error";
  version?: string;
  isDifferential?: boolean;
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
  error?: string;
}

// API cầu nối (contextBridge) do electron/preload.js expose vào renderer —
// chỉ tồn tại khi chạy trong Electron, không có trên trình duyệt thường.
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
      getAutoLaunchStatus: () => Promise<boolean>;
      toggleAutoLaunch: (enable: boolean) => Promise<boolean>;
      onTrayRunSpeedTest: (callback: () => void) => () => void;
    };
  }
}
