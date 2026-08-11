import { NextResponse } from "next/server";
import { getAppSetting, setAppSetting } from "@/lib/db";

export async function GET() {
  try {
    const interval = getAppSetting("schedule_interval", "off");
    const lastRun = getAppSetting("schedule_last_run", "");
    return NextResponse.json({ interval, lastRun });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi đọc cài đặt lịch đo" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { interval, markRun } = body;

    // markRun: ghi lại thời điểm vừa hoàn tất 1 lần đo tự động (gọi bởi
    // ScheduledSpeedTestRunner sau mỗi lần chạy) — tách riêng khỏi việc đổi
    // chu kỳ để không cần gửi lại "interval" mỗi lần chỉ muốn cập nhật mốc
    // thời gian.
    if (markRun) {
      setAppSetting("schedule_last_run", new Date().toISOString());
      return NextResponse.json({ success: true });
    }

    if (!["off", "1h", "6h", "12h", "24h"].includes(interval)) {
      return NextResponse.json({ error: "Chu kỳ không hợp lệ" }, { status: 400 });
    }

    setAppSetting("schedule_interval", interval);
    return NextResponse.json({ success: true, interval });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi lưu cài đặt lịch đo" }, { status: 500 });
  }
}
