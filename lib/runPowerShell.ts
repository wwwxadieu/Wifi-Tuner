import { spawn } from "node:child_process";

export function isWindows(): boolean {
  return process.platform === "win32";
}

// Chạy một script PowerShell và trả về stdout. Chỉ dùng cho các lệnh đọc
// thông tin (Get-*) — mọi thao tác ghi cấu hình hệ thống (Set-*, đổi DNS...)
// thuộc Giai đoạn 2 và sẽ cần xin quyền admin riêng, không dùng hàm này.
export function runPowerShell(script: string, timeoutMs = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const ps = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { windowsHide: true }
    );

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      ps.kill();
      reject(new Error("Lệnh PowerShell hết thời gian chờ"));
    }, timeoutMs);

    ps.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    ps.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    ps.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    ps.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim() || `powershell thoát với mã ${code}`));
      } else {
        resolve(stdout);
      }
    });
  });
}
