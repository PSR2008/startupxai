import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getPlanEntitlements } from "../src/lib/plans";
import { applyInternalLimits, resolveEntitlements } from "../src/lib/entitlements";

test("normal free user remains limited", () => {
  const entitlements = resolveEntitlements({ role: "user", plan: "free", active: false });
  assert.equal(entitlements.role, "user");
  assert.equal(entitlements.activePlan, "free");
  assert.equal(entitlements.effectivePlan, "free");
  assert.equal(entitlements.internalAccess, false);
  assert.equal(entitlements.paidSubscriptionActive, false);
  assert.equal(entitlements.usageLimits.monthlyAnalyses, getPlanEntitlements("free").monthlyAnalyses);
});

test("paid user receives paid access and is counted as paid", () => {
  const entitlements = resolveEntitlements({
    role: "user",
    plan: "growth",
    active: true,
    billingCycle: "monthly",
    expiresAt: "2999-01-01T00:00:00.000Z",
  });
  assert.equal(entitlements.activePlan, "growth");
  assert.equal(entitlements.effectivePlan, "growth");
  assert.equal(entitlements.paidSubscriptionActive, true);
  assert.equal(entitlements.internalAccess, false);
  assert.equal(entitlements.enabledFeatures.canShareReports, true);
});

test("internal user receives full feature access without payment", () => {
  const entitlements = resolveEntitlements({ role: "internal", plan: "free", active: false });
  assert.equal(entitlements.role, "internal");
  assert.equal(entitlements.activePlan, "free");
  assert.equal(entitlements.effectivePlan, "scale");
  assert.equal(entitlements.internalAccess, true);
  assert.equal(entitlements.paidSubscriptionActive, false);
  assert.equal(entitlements.enabledFeatures.canExportPdf, true);
  assert.equal(entitlements.usageLimits.monthlyAnalyses, 1_000_000);
});

test("admin user is not counted as paid without a real paid plan", () => {
  const entitlements = resolveEntitlements({ role: "admin", plan: "scale", active: false });
  assert.equal(entitlements.internalAccess, true);
  assert.equal(entitlements.effectivePlan, "scale");
  assert.equal(entitlements.paidSubscriptionActive, false);
});

test("expired paid plan falls back to free unless internal access exists", () => {
  const expiredNormal = resolveEntitlements({
    role: "user",
    plan: "scale",
    active: true,
    expiresAt: "2020-01-01T00:00:00.000Z",
    now: new Date("2026-07-22T00:00:00.000Z"),
  });
  assert.equal(expiredNormal.effectivePlan, "free");
  assert.equal(expiredNormal.paidSubscriptionActive, false);

  const expiredInternal = resolveEntitlements({
    role: "internal",
    plan: "scale",
    active: true,
    expiresAt: "2020-01-01T00:00:00.000Z",
    now: new Date("2026-07-22T00:00:00.000Z"),
  });
  assert.equal(expiredInternal.effectivePlan, "scale");
  assert.equal(expiredInternal.paidSubscriptionActive, false);
});

test("internal limits preserve all scale features while bypassing usage caps", () => {
  const scale = getPlanEntitlements("scale");
  const internal = applyInternalLimits(scale);
  assert.equal(internal.allowedEngines, "all");
  assert.equal(internal.canGenerateInvestorMemo, true);
  assert.equal(internal.monthlyAnalyses, 1_000_000);
  assert.equal(internal.startupWorkspaceLimit, 1_000_000);
});

test("role migration prevents client-side self escalation", () => {
  const migration = readFileSync(join(process.cwd(), "migrations/011_internal_user_roles.sql"), "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS user_roles/);
  assert.match(migration, /CHECK \(role IN \('user', 'internal', 'admin'\)\)/);
  assert.match(migration, /ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /FOR SELECT/);
  assert.doesNotMatch(migration, /FOR INSERT\s+WITH CHECK/i);
  assert.doesNotMatch(migration, /FOR UPDATE\s+USING/i);
});

test("server routes use centralized entitlement checks for gated features", () => {
  const usageLimit = readFileSync(join(process.cwd(), "src/lib/usage-limit.ts"), "utf8");
  const usage = readFileSync(join(process.cwd(), "src/lib/usage.ts"), "utf8");
  const exportRoute = readFileSync(join(process.cwd(), "src/app/api/export-pdf/route.ts"), "utf8");
  const reportRoute = readFileSync(join(process.cwd(), "src/app/api/reports/[id]/generate/route.ts"), "utf8");
  assert.match(usageLimit, /getUserEntitlements/);
  assert.match(usage, /getUserEntitlements/);
  assert.match(exportRoute, /getEffectivePlan/);
  assert.match(reportRoute, /getEffectivePlan/);
});

test("client-side request manipulation cannot assign roles through profile endpoints", () => {
  const founderProfileRoute = readFileSync(join(process.cwd(), "src/app/api/founder-profile/route.ts"), "utf8");
  assert.doesNotMatch(founderProfileRoute, /role\s*:/);
  assert.doesNotMatch(founderProfileRoute, /internal/i);
  assert.doesNotMatch(founderProfileRoute, /admin/i);
});

