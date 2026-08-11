import { NextResponse } from "next/server";
import { getVpnStatus } from "@/lib/vpnDetect";

export async function GET() {
  try {
    const status = await getVpnStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi kiểm tra VPN" }, { status: 500 });
  }
}
