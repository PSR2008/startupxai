import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { type SupabaseClient } from "@supabase/supabase-js";
import { ApiError, serializeApiError } from "../http/api-error";
import { type VerifiedPrincipal } from "../auth/principal";
import { requireAuthenticatedPrincipal, requireOrganizationMembership, requireOrganizationRole, requireProjectAccess, requireMembershipManagement } from "./authorization";
import { authorizationReader, databaseError, userDatabase } from "./database";
import { addMemberSchema, createOrganizationSchema, createProjectSchema, retentionSchema, transferSchema, updateMemberSchema, uuidSchema, secretPublicColumns, membershipSchema } from "./domain";
import { sourceRoute } from "../github/api";
import { executionRoute } from "../execution/api";
import { findingRoute } from "../execution/findings";
import { releaseRoute } from "../releases/api";
import { remediationRoute } from "../remediation/api";
import { capabilityRoute } from "../remediation/capability";

type Session = { principal: VerifiedPrincipal; db: SupabaseClient };
type SessionFactory = (request: Request) => Promise<Session>;
async function sessionFor(request: Request): Promise<Session> {
  const principal = await requireAuthenticatedPrincipal(request);
  return { principal, db: userDatabase(request, principal) };
}
async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new ApiError("INVALID_REQUEST");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("INVALID_REQUEST");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 16384) { await reader.cancel(); throw new ApiError("INVALID_REQUEST"); }
      chunks.push(value);
    }
    return schema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch { throw new ApiError("INVALID_REQUEST"); }
  finally { reader.releaseLock(); }
}
/** Dependency injection is for trusted server tests only, never request data. */
export function createLaunchGateHandler(sessionFactory: SessionFactory = sessionFor) {
  return async (request: Request): Promise<Response> => {
    const correlationId = randomUUID();
    const headers = { "Cache-Control": "no-store", "X-Correlation-ID": correlationId };
    try {
      const { principal, db } = await sessionFactory(request);
      const reader = authorizationReader(db);
      const url = new URL(request.url);
      const path = url.pathname.replace(/^\/api\/v1\//, "").split("/");
      const method = request.method;
      if (path[0] === "projects" && path[2] === "remediation-capabilities") return await capabilityRoute(request, { principal, db }, path, correlationId);
      if (path[0] === "projects" && (path[2] === "fix-proposals" || path[2] === "findings" && path[4] === "fix-proposals")) return await remediationRoute(request, { principal, db }, path, correlationId);
      if (path[0] === "projects" && ["releases", "policies"].includes(path[2])) return await releaseRoute(request, { principal, db }, path, correlationId);
      if (path[0] === "projects" && path.length >= 3) return await (path[2]==="findings"||path[2]==="runs"&&path[4]==="findings"?findingRoute:["environments","targets","runs","vercel"].includes(path[2]) ? executionRoute : sourceRoute)(request, { principal, db }, path, correlationId);
      const result = (data: unknown, status = 200) => Response.json({ ok: true, data, correlationId }, { status, headers });
      const rpc = async (name: string, args: Record<string, unknown>) => {
        const { data, error } = await db.rpc(name, { ...args, p_correlation: correlationId }).single(); databaseError(error); return data;
      };
      if (path[0] === "organizations" && path.length === 1) {
        if (method === "POST") {
          const input = await body(request, createOrganizationSchema);
          return result(await rpc("lg_create_organization", { p_name: input.name }), 201);
        }
        if (method === "GET") {
          const { data, error } = await db.from("lg_organizations").select("*").order("id").limit(100); databaseError(error); return result(data);
        }
      }
      if (path[0] === "organizations" && path.length >= 2) {
        const org = uuidSchema.parse(path[1]);
        if (path.length === 2 && method === "GET") {
          await requireOrganizationMembership(reader, principal, org);
          const { data, error } = await db.from("lg_organizations").select("*").eq("id", org).single(); databaseError(error); return result(data);
        }
        if (path[2] === "members") {
          const context = await requireOrganizationRole(reader, principal, org, "ADMIN");
          if (path.length === 3 && method === "GET") {
            const { data, error } = await db.from("lg_organization_memberships").select("*").eq("organization_id", org).order("id").limit(100); databaseError(error); return result(data);
          }
          if (path.length === 3 && method === "POST") {
            const input = await body(request, addMemberSchema); requireMembershipManagement(context, null, input.role);
            return result(await rpc("lg_manage_member", { p_organization: org, p_action: "ADD", p_user: input.userId, p_membership: null, p_role: input.role, p_status: "ACTIVE" }), 201);
          }
          if (path.length === 4 && (method === "PATCH" || method === "DELETE")) {
            const id = uuidSchema.parse(path[3]);
            const { data, error } = await db.from("lg_organization_memberships").select("*").eq("organization_id", org).eq("id", id).maybeSingle(); databaseError(error);
            if (!data) throw new ApiError("ACCESS_DENIED");
            const target = membershipSchema.parse(data);
            const input = method === "PATCH" ? await body(request, updateMemberSchema) : null;
            requireMembershipManagement(context, target.role, input?.role ?? null);
            return result(await rpc("lg_manage_member", { p_organization: org, p_action: input ? "UPDATE" : "REMOVE", p_user: null, p_membership: id, p_role: input?.role ?? null, p_status: input?.status ?? null }));
          }
        }
        if (path.length === 3 && path[2] === "ownership-transfer" && method === "POST") {
          await requireOrganizationRole(reader, principal, org, "OWNER");
          const input = await body(request, transferSchema);
          return result(await rpc("lg_manage_member", { p_organization: org, p_action: "TRANSFER", p_user: null, p_membership: input.membershipId, p_role: null, p_status: null }));
        }
        if (path.length === 3 && path[2] === "audit" && method === "GET") {
          await requireOrganizationRole(reader, principal, org, "ADMIN", true);
          const { data, error } = await db.from("lg_audit_events").select("*").eq("organization_id", org).order("created_at", { ascending: false }).order("id").limit(100); databaseError(error); return result(data);
        }
        if (path.length === 3 && path[2] === "secret-references" && method === "GET") {
          await requireOrganizationRole(reader, principal, org, "ADMIN");
          const { data, error } = await db.from("lg_secret_references").select(secretPublicColumns).eq("organization_id", org).order("id").limit(100); databaseError(error); return result(data);
        }
        if (path.length === 3 && path[2] === "retention-policies") {
          await requireOrganizationRole(reader, principal, org, method === "PUT" ? "ADMIN" : "VIEWER");
          if (method === "PUT") {
            const input = await body(request, retentionSchema);
            return result(await rpc("lg_set_retention", { p_organization: org, p_project: input.projectId, p_category: input.category, p_days: input.durationDays }));
          }
          if (method === "GET") {
            const { data, error } = await db.from("lg_retention_policies").select("*").eq("organization_id", org).order("id").limit(100); databaseError(error); return result(data);
          }
        }
        if (path.length === 3 && path[2] === "deletion-requests") {
          if (method === "POST") {
            await requireOrganizationRole(reader, principal, org, "OWNER");
            await body(request, z.object({}).strict());
            return result(await rpc("lg_request_deletion", { p_organization: org }), 202);
          }
          if (method === "GET") {
            await requireOrganizationRole(reader, principal, org, "ADMIN", true);
            const { data, error } = await db.from("lg_deletion_requests").select("*,lg_deletion_tasks(*)").eq("organization_id", org).limit(1); databaseError(error); return result(data);
          }
        }
      }
      if (path[0] === "projects") {
        if (path.length === 1 && method === "POST") {
          const input = await body(request, createProjectSchema);
          await requireOrganizationRole(reader, principal, input.organizationId, "DEVELOPER");
          return result(await rpc("lg_create_project", { p_organization: input.organizationId, p_name: input.name }), 201);
        }
        if (path.length === 1 && method === "GET") {
          const org = uuidSchema.parse(url.searchParams.get("organizationId"));
          await requireOrganizationMembership(reader, principal, org);
          const { data, error } = await db.from("lg_projects").select("*").eq("organization_id", org).order("id").limit(100); databaseError(error); return result(data);
        }
        if (path.length === 2 && method === "GET") {
          const context = await requireProjectAccess(reader, principal, uuidSchema.parse(path[1]));
          const { data, error } = await db.from("lg_projects").select("*").eq("id", context.project.id).eq("organization_id", context.organizationId).single(); databaseError(error); return result(data);
        }
      }
      throw new ApiError("INVALID_REQUEST");
    } catch (error) {
      const safe = error instanceof z.ZodError ? new ApiError("INVALID_REQUEST") : error;
      const serialized = serializeApiError(safe);
      return Response.json({ ...serialized.body, correlationId }, { status: serialized.status, headers });
    }
  };
}
export const handleLaunchGateRequest = createLaunchGateHandler();
