import { NextResponse } from "next/server";
import { getNetworkInfo } from "@/lib/networkInfo";

export const runtime = "nodejs";

export async function GET() {
  try {
    const info = await getNetworkInfo();
    return NextResponse.json(info);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Không thể đọc thông tin mạng" },
      { status: 500 }
    );
  }
}
