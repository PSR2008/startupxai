import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/usage-limit";

const OK = NextResponse.json({ ok: true, deprecated: true });

export async function POST(req: NextRequest) {
  await getUserIdFromRequest(req);
  return OK;
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
