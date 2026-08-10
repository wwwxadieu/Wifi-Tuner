const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron");
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
let serverExited = null;
const serverStderr = [];

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

function loadingHtml() {
  return `<!doctype html><html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0d12;color:#f2f5f8;font-family:Segoe UI,-apple-system,sans-serif;">
    <div style="text-align:center;">
      <div style="font-size:15px;font-weight:600;letter-spacing:.02em;">WiFi Tuner</div>
      <div style="margin-top:10px;font-size:13px;color:rgba(242,245,248,.5);">Đang khởi động…</div>
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
  return `<!doctype html><html><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0d12;color:#f2f5f8;font-family:Segoe UI,-apple-system,sans-serif;padding:40px;box-sizing:border-box;">
    <div style="max-width:620px;text-align:center;">
      <div style="font-size:17px;font-weight:600;">Không thể khởi động WiFi Tuner</div>
      <div style="margin-top:12px;font-size:13px;line-height:1.6;color:rgba(242,245,248,.6);">${safe}</div>
      ${details}
      <div style="margin-top:20px;font-size:12px;color:rgba(242,245,248,.35);">Log chi tiết: ${escapeHtml(logPath)}</div>
      <div style="margin-top:6px;font-size:12px;color:rgba(242,245,248,.35);">Thử tắt tạm phần mềm diệt virus rồi mở lại ứng dụng.</div>
    </div>
  </body></html>`;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0a0d12",
    title: "WiFi Tuner",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingHtml())}`);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
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
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
