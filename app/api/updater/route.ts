import { NextResponse } from "next/server";
import packageJson from "@/package.json";

export async function GET() {
  try {
    const currentVersion = packageJson.version || "0.1.0";
    let latestVersion = currentVersion;
    let releaseNotes = "";
    let isUpdateAvailable = false;
    let assets: any[] = [];

    // Fetch latest release from GitHub API
    try {
      const res = await fetch("https://api.github.com/repos/wwwxadieu/Wifi-Tuner/releases/latest", {
        headers: { "User-Agent": "WiFi-Tuner-App" },
        next: { revalidate: 300 }, // Cache for 5 mins
      });

      if (res.ok) {
        const data = await res.json();
        latestVersion = (data.tag_name || "").replace(/^v/, "");
        releaseNotes = data.body || "";
        assets = data.assets || [];
        isUpdateAvailable = latestVersion !== currentVersion;
      }
    } catch {}

    return NextResponse.json({
      currentVersion,
      latestVersion,
      isUpdateAvailable,
      releaseNotes,
      assets,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi kiểm tra bản cập nhật" }, { status: 500 });
  }
}
