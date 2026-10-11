import assert from "node:assert/strict";
import { test } from "node:test";
import { fixtureFamilies, referenceFixtureSchema } from "@launchgate/contracts";
import { evaluateOutcome } from "@launchgate/verification-core";
import type { Domain, Invariant } from "@launchgate/invariant-spec";
import { fixtureEvidence, fixtureFamily, spec } from "./fixtures/launchgate";

const domains: Domain[] = ["tenant_isolation", "authorization", "paid_features", "billing", "webhooks", "ai_cost", "usage_concurrency", "authentication"];
const operations: Invariant["operation"]["kind"][] = ["resource.read", "role.change", "feature.invoke", "payment.observe", "webhook.deliver_test_event", "ai.invoke", "quota.concurrent_attempt", "session.check"];
fixtureFamilies.forEach((family, index) => {
  const fixture = referenceFixtureSchema.parse(fixtureFamily(family, domains[index]));
  for (const variant of ["vulnerable", "fixed", "inconclusive"] as const) {
    test(`reference lab ${family}/${variant} has the expected deterministic outcome`, () => {
      const invariant = { ...spec, id: family, domain: fixture.domain, assertions: [fixture.oracle],
        operation: { ...spec.operation, kind: operations[index] } };
      assert.equal(evaluateOutcome(invariant, fixtureEvidence(variant, invariant), { kind: "REFERENCE_LAB" }).outcome, fixture.variants[variant].expectedOutcome);
    });
  }
});
test("reference fixture identities must be distinct", () => {
  const f = fixtureFamily("tenant_isolation", "tenant_isolation");
  f.variants.fixed.identity = f.variants.vulnerable.identity;
  assert.equal(referenceFixtureSchema.safeParse(f).success, false);
});
