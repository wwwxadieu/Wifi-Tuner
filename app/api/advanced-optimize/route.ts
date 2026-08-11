import { NextResponse } from "next/server";
import { applyAdvancedOptimization, getAdvancedOptimizationStatus, resetWinsock, restoreBackupConfig } from "@/lib/optimize";
import type { AdvancedOptimizationSettings } from "@/lib/types";

export async function GET() {
  try {
    const status = await getAdvancedOptimizationStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi đọc trạng thái tinh chỉnh nâng cao" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, settings } = body as { action: string; settings?: AdvancedOptimizationSettings };

    if (action === "apply") {
      const defaultSettings: AdvancedOptimizationSettings = {
        enableRss: true,
        congestionProvider: "CTCP",
        disableDeliveryOptimizationP2P: true,
        ...settings,
      };
      const result = await applyAdvancedOptimization(defaultSettings);
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

    if (action === "winsock_reset") {
      const result = await resetWinsock();
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Lệnh không hợp lệ" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi xử lý yêu cầu tối ưu nâng cao" }, { status: 500 });
  }
}
