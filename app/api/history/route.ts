import { NextResponse } from "next/server";
import { clearSpeedHistory, getSpeedHistory, getSpeedStats, insertSpeedRecord } from "@/lib/db";
import { analyzeDriver } from "@/lib/driverCheck";

export async function GET() {
  try {
    const history = getSpeedHistory(50);
    const stats = getSpeedStats();
    const driver = await analyzeDriver();

    return NextResponse.json({
      history,
      stats,
      driver,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi lấy dữ liệu lịch sử" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { downloadMbps, uploadMbps, latencyMs, jitterMs, source } = body;

    const record = insertSpeedRecord({
      createdAt: new Date().toISOString(),
      downloadMbps: downloadMbps ?? null,
      uploadMbps: uploadMbps ?? null,
      latencyMs: latencyMs ?? null,
      jitterMs: jitterMs ?? null,
      source: source || "manual",
    });

    return NextResponse.json({ success: true, record });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi lưu kết quả đo" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    clearSpeedHistory();
    return NextResponse.json({ success: true, message: "Đã xóa toàn bộ lịch sử đo." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi xóa lịch sử" }, { status: 500 });
  }
}
