import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { VerifiedPrincipal } from "../auth/principal";
import { authorizationReader, databaseError } from "./database";
import { requireProjectAccess } from "./authorization";
import { ApiError } from "../http/api-error";
import { redact } from "@launchgate/source-analysis";

// Only these projections are available. No user-controlled table or column names.
export const productReads = {
  snapshots: ["lg_repository_snapshots", "id,connection_id,commit_sha,state,source_state,failure_code,created_at,updated_at"],
  architecture: ["lg_architecture_snapshots", "snapshot_id,report,created_at"],
  invariants: ["lg_invariant_proposals", "id,snapshot_id,domain,statement,details,created_at"],
  confirmations: ["lg_invariant_confirmations", "id,proposal_id,version,action,statement,created_at"],
  runs: ["lg_verification_runs", "id,commit_sha,state,result,purpose,deployment_id,created_at,updated_at"],
  findings: ["lg_findings", "id,invariant_id,invariant_version,state,created_at,updated_at"],
  regressions: ["lg_regression_tests", "id,finding_id,artifact,created_at"],
  environments: ["lg_environments", "id,name,type,status,created_at"],
  deployments: ["lg_deployments", "id,environment_id,provider,commit_sha,verification_state,created_at"],
  targets: ["lg_target_authorizations", "id,deployment_id,version,expires_at,revoked_at,request_limit,concurrency_limit,duration_seconds,created_at"],
  releases: ["lg_release_candidates", "id,commit_sha,deployment_id,policy_id,policy_version,identity,created_at"],
  gates: ["lg_gate_evaluations", "id,release_id,generation,decision,evaluation,created_at"],
  coverage: ["lg_gate_evaluation_items", "evaluation_id,invariant_id,status,item"],
  checks: ["lg_github_check_runs", "id,head_sha,evaluation_id,publication_state,created_at"],
  exceptions: ["lg_policy_exceptions", "id,release_id,invariant_id,finding_id,reason,actor_role,expires_at,revoked_at,created_at"],
  policies: ["lg_policy_versions", "policy_id,version,policy,created_at"],
  fixes: ["lg_fix_proposals", "id,finding_id,source_sha,policy_id,policy_version,mode,state,created_at,updated_at"],
  patches: ["lg_patch_artifacts", "proposal_id,proposal,patch_hash,created_at"],
  verifications: ["lg_fix_verification_runs", "proposal_id,release_id,state,evidence,created_at"],
  "pull-requests": ["lg_fix_pull_requests", "proposal_id,mode,branch,fix_sha,provider_reference,created_at"],
  "finding-events": ["lg_finding_events", "id,finding_id,run_id,state,created_at"],
  "fix-events": ["lg_fix_events", "id,proposal_id,kind,created_at"],
  "release-events": ["lg_release_events", "id,release_id,kind,created_at"],
  occurrences: ["lg_finding_occurrences", "finding_id,run_id,outcome"],
  evidence: ["lg_reproduction_bundles", "run_id,attempt_id,manifest_digest,bundle"],
  "write-permissions": ["lg_remediation_capabilities", "id,connection_id,enabled,verified_at,expires_at,revoked_at"],
} as const;

/** Defense in depth for bounded, already-redacted evidence JSON. Never render HTML. */
export function safeProductValue(value: unknown, depth = 0): unknown {
  if (depth > 16) return "[TRUNCATED]";
  if (typeof value === "string") return redact(value).slice(0, 24000);
  if (Array.isArray(value)) return value.slice(0, 200).map(v => safeProductValue(v, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !/secret|token|password|cookie|authorization|credential|private.?key|locator|raw.?body/i.test(key)).map(([key, v]) => [key, safeProductValue(v, depth + 1)]));
  return value;
}

export async function productReadRoute(request: Request, session: { principal: VerifiedPrincipal; db: SupabaseClient }, path: string[], correlationId: string) {
  if (request.method !== "GET" || path.length !== 4) throw new ApiError("INVALID_REQUEST");
  const projectId = z.string().uuid().parse(path[1]);
  const access = await requireProjectAccess(authorizationReader(session.db), session.principal, projectId);
  if (path[3] === "access") return Response.json({ ok: true, data: { role: access.membership.role, organizationId: access.organizationId }, correlationId }, { headers: { "Cache-Control": "no-store" } });
  if (!Object.hasOwn(productReads, path[3])) throw new ApiError("INVALID_REQUEST");
  const [table, columns] = productReads[path[3] as keyof typeof productReads];
  const url = new URL(request.url);
  const offset = z.coerce.number().int().min(0).max(100000).parse(url.searchParams.get("offset") ?? 0);
  let query = session.db.from(table as string).select(columns as string).eq("organization_id", access.organizationId).eq("project_id", projectId);
  const parent = url.searchParams.get("parent");
  if (parent) {
    const id = z.string().uuid().parse(parent);
    const foreignKeys: Record<string, string> = { patches: "proposal_id", verifications: "proposal_id", "pull-requests": "proposal_id", "fix-events": "proposal_id", "finding-events": "finding_id", occurrences: "finding_id", regressions: "finding_id", "release-events": "release_id", exceptions: "release_id", gates: "release_id", coverage: "evaluation_id", checks: "evaluation_id", evidence: "run_id" };
    const column = foreignKeys[path[3]];
    if (!column) throw new ApiError("INVALID_REQUEST");
    query = query.eq(column, id);
  }
  // All pages have stable ordering, including tables with composite primary keys.
  if (columns.includes("created_at")) query = query.order("created_at", { ascending: false });
  query = query.order(columns.split(",")[0]);
  const tieBreaker: Record<string,string> = {coverage:"invariant_id",occurrences:"run_id",policies:"version"};
  if(tieBreaker[path[3]]) query=query.order(tieBreaker[path[3]]);
  const { data, error } = await query.range(offset, offset + 49); databaseError(error);
  let output: unknown = path[3] === "evidence" ? (data ?? []).map(row => {
    const record = row as unknown as Record<string, unknown>;
    const bundle = record.bundle as Record<string, unknown>;
    const evidence = bundle.evidence as Record<string, unknown> | undefined;
    const plan = bundle.plan as Record<string, unknown> | undefined;
    // No artifact storage references, raw source context or execution grants.
    return { run_id: record.run_id, manifest_digest: record.manifest_digest, invariant: plan?.spec, scope: evidence?.scope, original: evidence?.original, reproduction: evidence?.reproduction, createdAt: evidence?.createdAt };
  }) : data;
  if (path[3] === "findings" && data?.length) {
    const requirements = await session.db.from("lg_policy_invariants").select("invariant_id,invariant_version,requirement").eq("organization_id", access.organizationId).eq("project_id", projectId).order("policy_version", { ascending: false }).range(0, 999);
    databaseError(requirements.error);
    output = (data as unknown as Record<string, unknown>[]).map(finding => {
      const match = requirements.data?.find(r => r.invariant_id === finding.invariant_id && r.invariant_version === finding.invariant_version);
      const invariant = (match?.requirement as { invariant?: { statement?: string; severity?: string; domain?: string } } | undefined)?.invariant;
      return { ...finding, title: invariant?.statement ?? "Business boundary violation", severity: invariant?.severity ?? "NOT_RECORDED", domain: invariant?.domain ?? "NOT_RECORDED" };
    });
  }
  return Response.json({ ok: true, data: safeProductValue(output), correlationId }, { headers: { "Cache-Control": "no-store", "X-Correlation-ID": correlationId } });
}
