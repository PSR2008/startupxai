import { NextRequest, NextResponse } from "next/server";
import { getFounderProfile, upsertFounderProfile, type FounderProfileInput } from "@/lib/founder-profile";
import { getUserIdFromRequest } from "@/lib/usage-limit";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const profile = await getFounderProfile(userId);
  return NextResponse.json({ success: true, profile });
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const input: FounderProfileInput = {
    startup_idea: clean(body.startup_idea),
    product_summary: clean(body.product_summary),
    target_audience: clean(body.target_audience),
    industry: clean(body.industry) || null,
    founder_stage: clean(body.founder_stage) || null,
    region: clean(body.region) || null,
    primary_goal: clean(body.primary_goal) || null,
  };

  if (!input.startup_idea || !input.product_summary || !input.target_audience) {
    return NextResponse.json(
      { success: false, error: "Startup idea, product summary, and target audience are required" },
      { status: 422 }
    );
  }

  const saved = await upsertFounderProfile(userId, input);
  if (!saved) {
    return NextResponse.json(
      { success: false, error: "Unable to save onboarding profile" },
      { status: 500 }
    );
  }

  const profile = await getFounderProfile(userId);
  return NextResponse.json({ success: true, profile });
}
