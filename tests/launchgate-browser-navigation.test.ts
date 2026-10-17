import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { collectBrowser } from "../reference-lab/browser/collector";
import { activeBrowserFixtures, startBrowserFixture } from "../reference-lab/browser/fixture";
import { browserPositive } from "../reference-lab/browser/oracle";
import { labGrant, makePlan } from "./fixtures/dynamic-lab";

for (const [authorizationMs, expected] of [[1800, "COMPLETED"], [5500, "UNOBSERVABLE"]] as const) {
  test(`browser navigation retains its own deadline when request authorization takes ${authorizationMs}ms`, async () => {
    const plan = makePlan("browser.release");
    const runtime = await startBrowserFixture(plan, "fixed");
    let requests = 0;
    // Request two is the control form submission. Deliberately cross the
    // 1500ms action timeout, then the existing 5000ms navigation timeout.
    const trace = await collectBrowser(plan, labGrant(plan, "fixed"), runtime,
      new AbortController().signal, async () => {
        if (++requests === 2) await delay(authorizationMs);
      }, async value => browserPositive(plan, value), async () => {});
    assert.equal(trace.execution, expected, JSON.stringify(trace.browser));
    assert.equal(trace.cleanup, true);
    assert.equal(activeBrowserFixtures(), 0);
    if (expected === "COMPLETED") {
      assert.equal(browserPositive(plan, trace), true);
      assert.ok(trace.browser!.checks.length > 0 && trace.browser!.checks.every(Boolean));
      assert.equal(trace.browser!.state!.authenticated, false);
      assert.equal(trace.requests, requests);
    } else {
      assert.equal(trace.browser!.state, null);
      assert.equal(trace.browser!.reason, "BROWSER_FAILURE");
    }
  });
}
