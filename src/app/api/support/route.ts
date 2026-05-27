import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { getUserIdFromRequest } from "@/lib/usage-limit";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = clean(body.name);
  const email = clean(body.email).toLowerCase();
  const category = clean(body.subject || body.category || "general");
  const message = clean(body.message);

  if (!name || !email || !category || !message) {
    return NextResponse.json(
      { success: false, error: "Name, email, subject, and message are required" },
      { status: 422 }
    );
  }

  if (!isEmail(email)) {
    return NextResponse.json(
      { success: false, error: "Enter a valid email address" },
      { status: 422 }
    );
  }

  if (message.length < 20 || message.length > 2000) {
    return NextResponse.json(
      { success: false, error: "Message must be between 20 and 2000 characters" },
      { status: 422 }
    );
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Support storage is not configured" },
      { status: 500 }
    );
  }

  const userId = await getUserIdFromRequest(req);
  const { error } = await admin.from("support_requests").insert({
    name,
    email,
    category,
    message,
    user_id: userId,
  });

  if (error) {
    console.error("[support] insert failed:", error.message);
    return NextResponse.json(
      { success: false, error: "Unable to submit support request" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
