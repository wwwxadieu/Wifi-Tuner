import { NextResponse } from "next/server";
import { getWifiScan } from "@/lib/wifiScan";

export const runtime = "nodejs";

export async function GET() {
  try {
    const scan = await getWifiScan();
    return NextResponse.json(scan);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Không thể quét mạng WiFi lân cận" },
      { status: 500 }
    );
  }
}
