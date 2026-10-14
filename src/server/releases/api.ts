import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VerifiedPrincipal } from "../auth/principal";
import { authorizationReader, databaseError } from "../launchgate/database";
import { requireProjectAccess, requireOrganizationRole } from "../launchgate/authorization";
import { boundedBody } from "../github/provider";
import { ApiError } from "../http/api-error";
import { releasePolicySchema } from "../../../services/releases/contracts";
import { invariantSetDigest } from "../../../services/releases/engine";
export async function releaseRoute(request: Request, session: { principal: VerifiedPrincipal; db: SupabaseClient }, path: string[], correlationId: string) {
  const { principal, db } = session, projectId = z.string().uuid().parse(path[1]), reader = authorizationReader(db);
  const access = await requireProjectAccess(reader, principal, projectId);
  const respond = (data: unknown, status = 200) => Response.json({ ok: true, data, correlationId }, { status, headers: { "Cache-Control": "no-store", "X-Correlation-ID": correlationId } });
  if (request.method === "GET") {
    if (path[2] === "policies" && path.length === 3) { const r = await db.from("lg_policy_versions").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(100); databaseError(r.error); return respond(r.data); }
    if (path[2] === "releases" && path.length <= 5) {
      const releaseId = path[3] ? z.string().uuid().parse(path[3]) : null;
      if (path.length === 5 && path[4] !== "gate") throw new ApiError("INVALID_REQUEST");
      const table = path[4] === "gate" ? "lg_gate_evaluations" : "lg_release_candidates";
      let query = db.from(table).select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(100);
      if (releaseId) query = query.eq(table === "lg_gate_evaluations" ? "release_id" : "id", releaseId);
      const r = await query; databaseError(r.error); return respond(r.data);
    }
  }
  if (request.method !== "POST") throw new ApiError("INVALID_REQUEST");
  await requireOrganizationRole(reader, principal, access.organizationId, path[4] === "re-evaluate" ? "DEVELOPER" : "ADMIN");
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ApiError("INVALID_REQUEST");
  let body: unknown; try { body = JSON.parse(Buffer.from(await boundedBody(new Response(request.body), 1048576)).toString("utf8")); } catch { throw new ApiError("INVALID_REQUEST"); }
  let action: string, data: Record<string, unknown>;
  if (path[2] === "policies" && path.length === 3) {
    const input = z.object({ name: z.string().min(1).max(100), policy: releasePolicySchema }).strict().parse(body);
    z.string().uuid().parse(input.policy.id); input.policy.requirements.forEach(r => z.string().uuid().parse(r.invariant.id));
    action = "POLICY"; data = { ...input, invariantSetDigest: invariantSetDigest(input.policy) };
  } else if (path[2] === "policies" && path[3] === "configure" && path.length === 4) {
    action = "CONFIGURE"; data = z.object({ connectionId: z.string().uuid(), policyId: z.string().uuid(), policyVersion: z.number().int().positive(), environmentId: z.string().uuid() }).strict().parse(body);
  } else if (path[2] === "releases" && path.length === 5) {
    const releaseId = z.string().uuid().parse(path[3]);
    if (path[4] === "re-evaluate") { z.object({}).strict().parse(body); action = "REEVALUATE"; data = { releaseId }; }
    else if (path[4] === "exceptions") { action = "EXCEPTION"; data = { ...z.object({ invariantId: z.string().uuid(), findingId: z.string().uuid().nullable(), reason: z.string().trim().min(1).max(1000), expiresAt: z.string().datetime(), ticket: z.string().max(500).nullable() }).strict().parse(body), releaseId }; }
    else if (path[4] === "revoke-exception") { action = "REVOKE_EXCEPTION"; data = { ...z.object({ exceptionId: z.string().uuid() }).strict().parse(body), releaseId }; }
    else throw new ApiError("INVALID_REQUEST");
  } else throw new ApiError("INVALID_REQUEST");
  const result = await db.rpc("lg_release_command", { p_project: projectId, p_action: action, p_data: data, p_correlation: correlationId }); databaseError(result.error); return respond(result.data, 202);
}
