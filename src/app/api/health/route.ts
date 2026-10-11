import { NextResponse } from "next/server";
import { publicHealth } from "@/server/env";

export async function GET() {
  return NextResponse.json({ ...publicHealth(), timestamp: new Date().toISOString() }, {
    status: 200, headers: { "Cache-Control": "no-store" },
  });
}
