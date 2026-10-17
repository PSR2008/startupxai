import type { ExecutionGrant } from "@launchgate/contracts";
import { publicAddress, targetUrl, type Address } from "../runner/target";
import { isolationPolicy, scopeKey, type EgressPolicy, type Scope, type Attestation } from "./contracts";
import { canonical, digest } from "../runner/metadata";
import { isIP } from "node:net";
export function egressPolicy(grant: ExecutionGrant): EgressPolicy {
  if (grant.referenceLab || grant.authorization.allowedPorts.length !== 1 || grant.authorization.allowedPorts[0] !== 443) throw new Error("PRODUCTION_TARGET_REQUIRED");
  const host = targetUrl(grant.deploymentUrl, grant.authorization.targetHost).hostname;
  return { defaultAction: "DENY", host, port: 443, protocol: "https", dns: "VALIDATE_ALL_AND_PIN_EACH_CONNECTION", redirects: "DENY", subresources: "SAME_POLICY", metadata: "DENY", providerEndpoints: [] };
}
/** Used by a provider's mandatory egress gateway for EVERY request/subresource. */
export function authorizeDestination(policy: EgressPolicy, url: string, addresses: Address[]): Address {
  targetUrl(url, policy.host);
  if (!addresses.length || addresses.some(a => !publicAddress(a.address) || isIP(a.address) !== a.family)) throw new Error("EGRESS_DENIED");
  return addresses[0];
}
export function confinedScratch(path: string): string {
  if (!/^\/scratch\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(path) || path.split("/").some(p => p === "." || p === "..")) throw new Error("FILESYSTEM_SCOPE");
  return path;
}
export const policyDigest = (egress: EgressPolicy) => digest(canonical({ isolation: isolationPolicy, egress }));
export function validateAttestation(a: Attestation, expected: { scope: Scope; sandboxId: string; imageDigest: string; policyDigest: string; provider: string }, now = Date.now()) {
  if (a.provider !== expected.provider || a.sandboxId !== expected.sandboxId || scopeKey(a.scope) !== scopeKey(expected.scope) || a.imageDigest !== expected.imageDigest || a.policyDigest !== expected.policyDigest ||
    !["HARDWARE", "HARDENED_JOB"].includes(a.isolation) || !/^attestation:[a-zA-Z0-9/_-]{1,200}$/.test(a.proofReference) || !Number.isFinite(Date.parse(a.issuedAt)) || Date.parse(a.issuedAt) > now || !(Date.parse(a.expiresAt) > now) || Date.parse(a.expiresAt) - Date.parse(a.issuedAt) > 900000) throw new Error("ATTESTATION_DENIED");
}
