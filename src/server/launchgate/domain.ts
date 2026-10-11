import { z } from "zod";

// Manually maintained narrow types, NOT generated Supabase schema output.
export const roleSchema = z.enum(["VIEWER", "DEVELOPER", "ADMIN", "OWNER"]);
export type OrganizationRole = z.infer<typeof roleSchema>;
export const roleRank: Readonly<Record<OrganizationRole, number>> = Object.freeze({ VIEWER: 0, DEVELOPER: 1, ADMIN: 2, OWNER: 3 });
export const uuidSchema = z.string().uuid();
export const nameSchema = z.string().trim().min(1).max(120);
export const createOrganizationSchema = z.object({ name: nameSchema }).strict();
export const createProjectSchema = z.object({ organizationId: uuidSchema, name: nameSchema }).strict();
export const addMemberSchema = z.object({ userId: uuidSchema, role: roleSchema }).strict();
export const updateMemberSchema = z.object({ role: roleSchema, status: z.enum(["ACTIVE", "DISABLED", "REMOVED"]) }).strict();
export const retentionSchema = z.object({ projectId: uuidSchema.nullable().default(null), category: z.enum(["SOURCE_SNAPSHOTS", "ARTIFACTS", "FINDINGS", "AUDIT_EVENTS", "CREDENTIALS"]), durationDays: z.number().int().min(1).max(3650) }).strict();
export const transferSchema = z.object({ membershipId: uuidSchema }).strict();
export const membershipSchema = z.object({ id: uuidSchema, organization_id: uuidSchema, user_id: uuidSchema, role: roleSchema, status: z.enum(["ACTIVE", "DISABLED", "REMOVED"]) });
export type Membership = z.infer<typeof membershipSchema>;
export interface Project { id: string; organization_id: string; status: "ACTIVE" | "ARCHIVED" }
export const secretPublicColumns = "id,organization_id,project_id,kind,provider,purpose,created_by,created_at,last_rotated_at,revoked_at,status";
