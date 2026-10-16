import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VerifiedPrincipal } from "../auth/principal";
import { authorizationReader, databaseError } from "../launchgate/database";
import { requireProjectAccess, requireOrganizationRole } from "../launchgate/authorization";
import { boundedBody } from "../github/provider";
import { ApiError } from "../http/api-error";

export async function remediationRoute(request: Request, session: { principal: VerifiedPrincipal; db: SupabaseClient }, path: string[], correlationId: string) {
  const projectId = z.string().uuid().parse(path[1]), reader = authorizationReader(session.db);
  const access = await requireProjectAccess(reader, session.principal, projectId), findingRoute = path[2] === "findings" && path.length === 5 && path[4] === "fix-proposals";
  const proposalRoute = path[2] === "fix-proposals" && (path.length === 4 || path.length === 5);
  if (!findingRoute && !proposalRoute) throw new ApiError("INVALID_REQUEST");
  const targetId = z.string().uuid().parse(path[3]);
  const respond = (data: unknown, status = 200) => Response.json({ ok: true, data, correlationId }, { status, headers: { "Cache-Control": "no-store", "X-Correlation-ID": correlationId } });
  if (request.method === "GET" && (findingRoute || path.length === 4)) {
    const r = await session.db.from("lg_fix_proposals").select("*").eq("project_id", projectId).eq(findingRoute ? "finding_id" : "id", targetId).order("created_at", { ascending: false }).limit(100);
    databaseError(r.error); return respond(r.data);
  }
  if (request.method !== "POST") throw new ApiError("INVALID_REQUEST");
  // V1 intentionally grants actions only to OWNER/ADMIN; developers may read.
  await requireOrganizationRole(reader, session.principal, access.organizationId, "ADMIN");
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ApiError("INVALID_REQUEST");
  let body: unknown; try { body = JSON.parse(Buffer.from(await boundedBody(new Response(request.body), 4096)).toString("utf8")); } catch { throw new ApiError("INVALID_REQUEST"); }
  let action: string, data: Record<string, unknown>;
  if (findingRoute) {
    action = "REQUEST"; data = { ...z.object({ requestKey: z.string().uuid(), policyId: z.string().uuid(), policyVersion: z.number().int().positive() }).strict().parse(body), findingId: targetId };
  } else {
    const actions: Record<string, string> = { validate: "VALIDATE", "pull-request": "PR", verify: "VERIFY" };
    action = actions[path[4]]; if (!action || path.length !== 5) throw new ApiError("INVALID_REQUEST");
    data = { ...z.object({ requestKey: z.string().uuid() }).strict().parse(body), proposalId: targetId };
  }
  const result = await session.db.rpc("lg_fix_command", { p_project: projectId, p_action: action, p_data: data, p_correlation: correlationId }); databaseError(result.error);
  return respond(result.data, 202);
}
