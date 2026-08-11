const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const PORT = 47931;
const HOST = "127.0.0.1";
const UPDATE_CHECK_INTERVAL_MS = 2 * 60 * 60 * 1000;
const MAX_STDERR_LINES = 20;
// Chỉ cho phép mở link ra ngoài qua các scheme này (chặn file://, javascript:, v.v.)
const ALLOWED_EXTERNAL_SCHEMES = ["https:", "http:", "ms-settings:"];

let serverProcess = null;
let mainWindow = null;
let tray = null;
let serverExited = null;
let isQuitting = false;
let hasShownTrayHint = false;
const serverStderr = [];

// Icon đóng gói kèm build (khai báo ở package.json -> extraResources cho
// bản đã package; đọc trực tiếp từ build/ khi chạy dev).
function getAssetPath(filename) {
  return app.isPackaged ? path.join(process.resourcesPath, filename) : path.join(__dirname, "..", "build", filename);
}

const logPath = path.join(app.getPath("userData"), "wifituner.log");
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(" ")}`;
  console.log(line);
  try {
    fs.appendFileSync(logPath, line + "\n");
  } catch {
    // ignore
  }
}

function getServerPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "standalone", "server.js")
    : path.join(__dirname, "..", ".next", "standalone", "server.js");
}

function waitForServer(deadline) {
  return new Promise((resolve, reject) => {
    if (serverExited) return reject(serverExited);

    const req = http.get({ host: HOST, port: PORT, path: "/", timeout: 2000 }, (res) => {
      res.resume();
      resolve();
    });
    req.on("error", (err) => {
      if (serverExited) return reject(serverExited);
      if (Date.now() > deadline) return reject(err);
      setTimeout(() => waitForServer(deadline).then(resolve, reject), 500);
    });
    req.on("timeout", () => req.destroy());
  });
}

function startServer() {
  const serverPath = getServerPath();
  log("Server path:", serverPath, "exists:", fs.existsSync(serverPath));

  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(PORT),
      HOSTNAME: HOST,
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (chunk) => log("[server:stdout]", chunk.toString().trim()));
  serverProcess.stderr.on("data", (chunk) => {
    const text = chunk.toString().trim();
    log("[server:stderr]", text);
    for (const line of text.split("\n")) {
      serverStderr.push(line);
    }
    if (serverStderr.length > MAX_STDERR_LINES) {
      serverStderr.splice(0, serverStderr.length - MAX_STDERR_LINES);
    }
  });
  serverProcess.on("error", (err) => {
    log("[server] spawn error:", err.message);
    serverExited = err;
  });
  serverProcess.on("exit", (code, signal) => {
    log("[server] exited code:", code, "signal:", signal);
    if (code !== 0) {
      serverExited = new Error(`Server process exited early (code ${code}, signal ${signal})`);
    }
  });

  return waitForServer(Date.now() + 40000);
}

// Màn hình khởi động (splash) hiển thị qua data:text/html trước khi server
// Next.js kịp chạy — không có Tailwind/asset ngoài ở giai đoạn này nên mọi
// CSS/màu/animation viết tay, nhưng dùng đúng token màu + easing của app
// (tailwind.config.ts: accent #0a84ff, accent2 #64d2ff, cubic-bezier(.16,1,
// .3,1)) và tái dùng nguyên vẹn glyph SVG của icon app (build/icon.png) để
// đồng bộ hình ảnh với icon taskbar/tray thật.
function loadingHtml() {
  return `<!doctype html><html><head><style>
    @keyframes iconIn { 0% { opacity:0; transform:scale(.82); } 100% { opacity:1; transform:scale(1); } }
    @keyframes fadeUp { 0% { opacity:0; transform:translateY(16px); } 100% { opacity:1; transform:translateY(0); } }
    @keyframes dotPulse { 0%,80%,100% { opacity:.25; transform:scale(.72); } 40% { opacity:1; transform:scale(1); } }
    .splash-icon { animation: iconIn .6s cubic-bezier(.16,1,.3,1) both; }
    .splash-title { animation: fadeUp .5s cubic-bezier(.16,1,.3,1) .18s both; }
    .splash-status { animation: fadeUp .5s cubic-bezier(.16,1,.3,1) .3s both; }
    .splash-dots { animation: fadeUp .5s cubic-bezier(.16,1,.3,1) .38s both; }
    .splash-dot { animation: dotPulse 1.2s ease-in-out infinite; }
    .splash-dot:nth-child(2) { animation-delay: .15s; }
    .splash-dot:nth-child(3) { animation-delay: .3s; }
  </style></head>
  <body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse 60% 50% at 50% 42%, rgba(10,132,255,.16) 0%, rgba(5,5,7,0) 70%), #050507;color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;">
    <div style="text-align:center;">
      <div class="splash-icon" style="width:88px;height:88px;margin:0 auto;border-radius:20px;background:linear-gradient(135deg,#0a84ff 0%,#64d2ff 100%);box-shadow:0 12px 40px rgba(10,132,255,.35);display:flex;align-items:center;justify-content:center;">
        <svg viewBox="0 0 100 100" width="52" height="52" fill="none">
          <circle cx="50" cy="78" r="7.5" fill="white"/>
          <path d="M 28 58 A 31 31 0 0 1 72 58" stroke="white" stroke-width="9" stroke-linecap="round"/>
          <path d="M 12 40 A 54 54 0 0 1 88 40" stroke="white" stroke-width="9" stroke-linecap="round" opacity="0.62"/>
        </svg>
      </div>
      <div class="splash-title" style="margin-top:22px;font-size:17px;font-weight:600;letter-spacing:.01em;">WiFi Tuner</div>
      <div class="splash-status" style="margin-top:8px;font-size:13px;color:rgba(245,245,247,.5);">Đang khởi động…</div>
      <div class="splash-dots" style="margin-top:14px;display:flex;gap:6px;align-items:center;justify-content:center;">
        <span class="splash-dot" style="width:6px;height:6px;border-radius:50%;background:#64d2ff;display:inline-block;"></span>
        <span class="splash-dot" style="width:6px;height:6px;border-radius:50%;background:#64d2ff;display:inline-block;"></span>
        <span class="splash-dot" style="width:6px;height:6px;border-radius:50%;background:#64d2ff;display:inline-block;"></span>
      </div>
    </div>
  </body></html>`;
}

function escapeHtml(value) {
  return String(value).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);
}

function errorHtml(message) {
  const safe = escapeHtml(message);
  const details = serverStderr.length
    ? `<pre style="margin-top:20px;padding:14px;max-height:240px;overflow:auto;text-align:left;white-space:pre-wrap;word-break:break-word;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;font-size:11.5px;line-height:1.5;color:rgba(242,245,248,.65);">${escapeHtml(
        serverStderr.join("\n")
      )}</pre>`
    : "";
  return `<!doctype html><html><head><style>
    @keyframes fadeUp { 0% { opacity:0; transform:translateY(12px); } 100% { opacity:1; transform:translateY(0); } }
    .error-card { animation: fadeUp .5s cubic-bezier(.16,1,.3,1) both; }
  </style></head>
  <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#050507;color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;padding:40px;box-sizing:border-box;">
    <div class="error-card" style="max-width:620px;width:100%;text-align:center;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);border-radius:20px;padding:32px;box-sizing:border-box;">
      <div style="width:52px;height:52px;margin:0 auto 18px;border-radius:50%;background:rgba(255,69,58,.15);border:1px solid rgba(255,69,58,.3);display:flex;align-items:center;justify-content:center;">
        <span style="color:#ff453a;font-size:24px;font-weight:700;line-height:1;">!</span>
      </div>
      <div style="font-size:17px;font-weight:600;">Không thể khởi động WiFi Tuner</div>
      <div style="margin-top:12px;font-size:13px;line-height:1.6;color:rgba(245,245,247,.6);">${safe}</div>
      ${details}
      <div style="margin-top:20px;font-size:12px;color:rgba(245,245,247,.35);">Log chi tiết: ${escapeHtml(logPath)}</div>
      <div style="margin-top:6px;font-size:12px;color:rgba(245,245,247,.35);">Thử tắt tạm phần mềm diệt virus rồi mở lại ứng dụng.</div>
    </div>
  </body></html>`;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#050507",
    title: "WiFi Tuner",
    autoHideMenuBar: true,
    icon: getAssetPath("icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingHtml())}`);

  // Bấm nút đóng (X) chỉ ẩn cửa sổ xuống khay hệ thống thay vì thoát hẳn —
  // cần thiết để tính năng đo tốc độ tự động theo lịch tiếp tục chạy được
  // khi người dùng "đóng" app. Chỉ thoát thật khi chọn "Thoát" từ menu khay
  // hoặc khi hệ thống/updater chủ động yêu cầu quit (isQuitting = true).
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
    if (!hasShownTrayHint) {
      hasShownTrayHint = true;
      tray?.displayBalloon?.({
        title: "WiFi Tuner vẫn đang chạy",
        content: "Ứng dụng đã được ẩn xuống khay hệ thống để tiếp tục đo tốc độ tự động theo lịch. Nhấp icon khay để mở lại.",
      });
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  tray = new Tray(getAssetPath("tray-icon.png"));
  tray.setToolTip("WiFi Tuner");
  updateTrayMenu();

  tray.on("click", () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow.show();
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;
  const openAtLogin = app.isPackaged ? app.getLoginItemSettings().openAtLogin : false;

  const menu = Menu.buildFromTemplate([
    {
      label: "Mở WiFi Tuner",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: "Đo tốc độ ngay",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
        mainWindow?.webContents.send("tray-run-speedtest");
      },
    },
    { type: "separator" },
    {
      label: "Chạy cùng Windows",
      type: "checkbox",
      checked: openAtLogin,
      enabled: app.isPackaged,
      click: (menuItem) => {
        app.setLoginItemSettings({ openAtLogin: menuItem.checked, path: process.execPath });
        updateTrayMenu();
      },
    },
    { type: "separator" },
    {
      label: "Thoát",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
}

function broadcastUpdateStatus(data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-status", data);
  }
}

function setupAutoUpdater() {
  if (!app.isPackaged) {
    log("[updater] skipped (not packaged)");
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    log("[updater] checking for update");
    broadcastUpdateStatus({ status: "checking" });
  });

  autoUpdater.on("update-available", (info) => {
    log("[updater] update available:", info.version);
    // Differential updates are detected if files include blockmap or smaller size
    const isDifferential = Array.isArray(info.files) && info.files.some((f) => f.url && f.url.endsWith(".blockmap"));
    broadcastUpdateStatus({
      status: "available",
      version: info.version,
      releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes : "",
      isDifferential,
      files: info.files,
    });
  });

  autoUpdater.on("update-not-available", (info) => {
    log("[updater] already up to date");
    broadcastUpdateStatus({ status: "not-available", version: info?.version });
  });

  autoUpdater.on("error", (err) => {
    log("[updater] error:", err.message);
    broadcastUpdateStatus({ status: "error", error: err.message });
  });

  autoUpdater.on("download-progress", (p) => {
    log(`[updater] downloading ${Math.round(p.percent)}% (${Math.round(p.bytesPerSecond / 1024)} KB/s)`);
    broadcastUpdateStatus({
      status: "downloading",
      percent: Math.round(p.percent),
      transferred: p.transferred,
      total: p.total,
      bytesPerSecond: p.bytesPerSecond,
    });
  });

  autoUpdater.on("update-downloaded", async (info) => {
    log("[updater] update downloaded:", info.version);
    broadcastUpdateStatus({ status: "downloaded", version: info.version });

    const { response } = await dialog.showMessageBox(mainWindow ?? undefined, {
      type: "info",
      title: "Có bản cập nhật mới",
      message: `WiFi Tuner ${info.version} đã hoàn tất tải xuống. Khởi động lại ứng dụng để cập nhật?`,
      buttons: ["Cài đặt & Khởi động lại", "Để sau"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  const check = () => autoUpdater.checkForUpdates().catch((err) => log("[updater] check failed:", err.message));
  setTimeout(check, 5000);
  setInterval(check, UPDATE_CHECK_INTERVAL_MS);
}

ipcMain.handle("check-for-updates", async () => {
  if (!app.isPackaged) return { status: "not-packaged" };
  try {
    const res = await autoUpdater.checkForUpdates();
    return { status: "success", version: res?.updateInfo?.version };
  } catch (err) {
    return { status: "error", error: err.message };
  }
});

ipcMain.handle("download-update", async () => {
  if (!app.isPackaged) return false;
  try {
    await autoUpdater.downloadUpdate();
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("quit-and-install", () => {
  if (app.isPackaged) {
    autoUpdater.quitAndInstall();
  }
});

ipcMain.handle("get-auto-launch-status", () => {
  if (!app.isPackaged) return false;
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle("toggle-auto-launch", (_event, enable) => {
  if (!app.isPackaged) return false;
  app.setLoginItemSettings({ openAtLogin: !!enable, path: process.execPath });
  updateTrayMenu();
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle("open-external", (_event, url) => {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_EXTERNAL_SCHEMES.includes(parsed.protocol)) {
      log("[ipc] blocked open-external for scheme:", parsed.protocol);
      return false;
    }
    shell.openExternal(url);
    return true;
  } catch (err) {
    log("[ipc] invalid open-external url:", String(err));
    return false;
  }
});

app.whenReady().then(async () => {
  log("App starting. Packaged:", app.isPackaged, "Platform:", process.platform);
  Menu.setApplicationMenu(null);
  createWindow();
  createTray();
  setupAutoUpdater();

  try {
    await startServer();
    log("Server ready, loading app UI");
    mainWindow?.loadURL(`http://${HOST}:${PORT}/`);
  } catch (err) {
    log("[electron] failed to start WiFi Tuner server:", err.message);
    mainWindow?.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml(err.message))}`);
    mainWindow?.webContents.openDevTools({ mode: "detach" });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
