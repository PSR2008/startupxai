import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_AUTH_DESTINATION, normalizeAuthNextPath, OAUTH_NEXT_COOKIE } from "@/lib/auth-flow";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let rawNext: string | null = null;
  try {
    const body = (await req.json()) as { next?: unknown };
    rawNext = typeof body.next === "string" ? body.next : null;
  } catch {
    rawNext = null;
  }

  const next = normalizeAuthNextPath(rawNext ?? DEFAULT_AUTH_DESTINATION);
  const response = NextResponse.json({ next });
  response.cookies.set(OAUTH_NEXT_COOKIE, next, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}
