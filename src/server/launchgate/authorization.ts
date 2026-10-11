import "server-only";
import { isVerifiedPrincipal, principalFromRequest, type VerifiedPrincipal } from "../auth/principal";
import { ApiError } from "../http/api-error";
import { membershipSchema, roleRank, type Membership, type OrganizationRole, type Project } from "./domain";

export interface AuthorizationReader {
  membership(organizationId: string, userId: string, allowPending?: boolean): Promise<Membership | null>;
  project(projectId: string): Promise<Project | null>;
}
export interface OrganizationContext { readonly principal: VerifiedPrincipal; readonly organizationId: string; readonly membership: Membership }
export async function requireAuthenticatedPrincipal(request: Pick<Request, "headers">): Promise<VerifiedPrincipal> {
  const principal = await principalFromRequest(request);
  if (!principal) throw new ApiError("AUTHENTICATION_REQUIRED");
  return principal;
}
export async function requireOrganizationMembership(reader: AuthorizationReader, principal: VerifiedPrincipal, organizationId: string, allowPending = false): Promise<OrganizationContext> {
  if (!isVerifiedPrincipal(principal)) throw new ApiError("AUTHENTICATION_REQUIRED");
  const parsed = membershipSchema.safeParse(await reader.membership(organizationId, principal.userId, allowPending));
  if (!parsed.success || parsed.data.status !== "ACTIVE" || parsed.data.user_id !== principal.userId || parsed.data.organization_id !== organizationId) throw new ApiError("ACCESS_DENIED");
  return Object.freeze({ principal, organizationId, membership: Object.freeze(parsed.data) });
}
export async function requireOrganizationRole(reader: AuthorizationReader, principal: VerifiedPrincipal, organizationId: string, minimum: OrganizationRole, allowPending = false) {
  const context = await requireOrganizationMembership(reader, principal, organizationId, allowPending);
  if (roleRank[context.membership.role] < roleRank[minimum]) throw new ApiError("ACCESS_DENIED");
  return context;
}
export async function requireProjectAccess(reader: AuthorizationReader, principal: VerifiedPrincipal, projectId: string) {
  if (!isVerifiedPrincipal(principal)) throw new ApiError("AUTHENTICATION_REQUIRED");
  const project = await reader.project(projectId);
  if (!project || project.id !== projectId || project.status !== "ACTIVE") throw new ApiError("ACCESS_DENIED");
  const context = await requireOrganizationMembership(reader, principal, project.organization_id);
  return Object.freeze({ ...context, project: Object.freeze(project) });
}
export function requireMembershipManagement(context: OrganizationContext, targetRole: OrganizationRole | null, newRole: OrganizationRole | null) {
  const role = context.membership.role;
  if (role !== "OWNER" && (role !== "ADMIN" || [targetRole, newRole].some(value => value === "OWNER" || value === "ADMIN"))) throw new ApiError("ACCESS_DENIED");
}
