import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  checkAnalysisAccess,
  limitReachedAfterWorkResponse,
  recordAnalysisUsage,
} from "@/lib/usage-limit";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const usageCheck = await checkAnalysisAccess(req, "idea");
    if (!usageCheck.allowed) return usageCheck.response!;

    const prompt = `
You are a top startup advisor.

Take this startup idea and improve it to make it:
- more unique
- more monetizable
- more defensible
- more attractive to investors

INPUT IDEA:
${body.idea}

DESCRIPTION:
${body.description}

TARGET:
${body.targetAudience}

Return ONLY this JSON:

{
  "improvedIdea": "<better version of idea>",
  "newPositioning": "<strong positioning>",
  "monetizationTwist": "<how to make more money>",
  "defensibility": "<why this becomes hard to copy>"
}
`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text"
        ? response.content[0].text
        : "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);

    const parsed = JSON.parse(jsonMatch?.[0] || "{}");
    const recorded = await recordAnalysisUsage(
      usageCheck.userId!,
      "idea",
      usageCheck.entitlements.monthlyAnalyses
    );
    if (!recorded.inserted) {
      return limitReachedAfterWorkResponse({
        feature: "monthly_analyses",
        currentUsage: recorded.currentUsage,
        limit: recorded.limit,
        plan: usageCheck.plan,
      });
    }

    return NextResponse.json({
      success: true,
      data: parsed,
    });
  } catch {
    return NextResponse.json({
      success: false,
      error: "Failed to improve idea",
    });
  }
}
