import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { getUserIdFromRequest } from "@/lib/usage-limit";
import { generalRateLimiter, getRequestIp, rateLimitResponse } from "@/lib/rate-limit";
import { recordProjectActivity, requireProjectAccess } from "@/lib/evidence-workflow-store";
import { trackProductEvent } from "@/lib/analytics";
import {
  detectDuplicatePublicSource,
  fetchPublicSourceMetadata,
  sanitizeUrlForAnalytics,
  SourcePreviewError,
} from "@/lib/public-source";

export const runtime = "nodejs";

const sourcePreviewSchema = z.object({
  projectId: z.string().uuid(),
  url: z.string().trim().min(1).max(2048),
});

function userMessage(error: SourcePreviewError) {
  if (error.code === "invalid_url" || error.code === "blocked_private_address") return "Enter a valid public HTTP or HTTPS URL.";
  if (error.code === "redirect_blocked") return "This URL redirects to a destination that cannot be previewed.";
  if (error.code === "too_many_redirects") return "This URL redirects too many times.";
  if (error.code === "unsupported_content_type") return "Only public HTML or text pages can be added as URL evidence.";
  if (error.code === "response_too_large") return "This page is too large to preview safely.";
  if (error.code === "timeout") return "The source took too long to respond. Try again later.";
  return "The source could not be previewed.";
}

export async function POST(req: NextRequest) {
  const rate = generalRateLimiter.check(`source-preview:${getRequestIp(req)}`);
  if (!rate.success) return rateLimitResponse(rate.retryAfter!);

  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = sourcePreviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  const project = await requireProjectAccess(parsed.data.projectId, userId);
  if (!project) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });

  await trackProductEvent("public_source_preview_started", {
    userId,
    properties: { url: sanitizeUrlForAnalytics(parsed.data.url) },
  });

  try {
    const preview = await fetchPublicSourceMetadata(parsed.data.url);
    const admin = getSupabaseAdminClient();
    if (!admin) return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 500 });

    const existing = await admin
      .from("evidence_items")
      .select("id, title, source_url, raw_metadata")
      .eq("validation_project_id", parsed.data.projectId)
      .eq("user_id", userId)
      .not("source_url", "is", null)
      .limit(100);
    const duplicate = detectDuplicatePublicSource(preview.metadata, existing.data ?? []);

    if (duplicate) {
      await trackProductEvent("duplicate_public_source_detected", {
        userId,
        properties: { url: sanitizeUrlForAnalytics(preview.metadata.canonicalUrl), projectId: parsed.data.projectId },
      });
    }

    await recordProjectActivity({
      projectId: parsed.data.projectId,
      userId,
      activityType: "public_source_preview",
      title: `Public source previewed: ${preview.metadata.hostname}`,
      metadata: {
        canonicalUrl: sanitizeUrlForAnalytics(preview.metadata.canonicalUrl),
        duplicateEvidenceId: duplicate?.id ?? null,
      },
    });

    await trackProductEvent("public_source_preview_succeeded", {
      userId,
      properties: { url: sanitizeUrlForAnalytics(preview.metadata.canonicalUrl), projectId: parsed.data.projectId, duplicate: Boolean(duplicate) },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...preview,
        duplicate: duplicate ? { id: duplicate.id, title: duplicate.title } : null,
      },
    });
  } catch (err) {
    const sourceError = err instanceof SourcePreviewError
      ? err
      : new SourcePreviewError("source_unavailable", "The source could not be previewed.");
    await trackProductEvent("public_source_preview_failed", {
      userId,
      properties: { url: sanitizeUrlForAnalytics(parsed.data.url), projectId: parsed.data.projectId, reason: sourceError.code },
    });
    return NextResponse.json({ success: false, code: sourceError.code, error: userMessage(sourceError) }, { status: 422 });
  }
}
