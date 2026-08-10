import { NextResponse } from "next/server";
import { applyOptimization, clearBackupConfig, getOptimizationStatus, restoreBackupConfig } from "@/lib/optimize";
import type { OptimizationSettings } from "@/lib/types";

export async function GET() {
  try {
    const status = await getOptimizationStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi đọc trạng thái tối ưu" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, settings } = body as { action: string; settings?: OptimizationSettings };

    if (action === "optimize") {
      const defaultSettings: OptimizationSettings = {
        dnsPreset: "cloudflare",
        enableTcpTuning: true,
        disablePowerSave: true,
        ...settings,
      };
      const result = await applyOptimization(defaultSettings);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    if (action === "restore") {
      const result = await restoreBackupConfig();
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    if (action === "clear_backup") {
      clearBackupConfig();
      return NextResponse.json({ success: true, message: "Đã xóa dữ liệu sao lưu." });
    }

    return NextResponse.json({ error: "Lệnh không hợp lệ" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi xử lý yêu cầu tối ưu" }, { status: 500 });
  }
}
