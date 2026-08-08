import { NextResponse } from "next/server";
import { isAllowedPingHost, pingHost } from "@/lib/ping";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body không hợp lệ" }, { status: 400 });
  }

  const host = typeof (body as { host?: unknown })?.host === "string" ? (body as { host: string }).host : "";
  if (!isAllowedPingHost(host)) {
    return NextResponse.json({ error: "Host không được phép" }, { status: 400 });
  }

  try {
    const result = await pingHost(host);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Không thể đo độ trễ" },
      { status: 500 }
    );
  }
}
