# Controlled browser journeys — Phase 7

Playwright Chromium drives real browser navigation and form submissions against disposable local HTTP fixtures. The browser subprocess is launched by the Reference Lab runner outside Next.js request handling. It receives a minimal OS environment, a fresh browser context, no extensions, disabled downloads/service workers and no page JavaScript. This controlled fixture runner is not an arbitrary customer-code sandbox.

## Bounded specification

Versioned plans contain only registered NAVIGATE, CLICK, FILL, SUBMIT, WAIT_FOR, ASSERT_VISIBLE, ASSERT_URL, ASSERT_TEXT and ASSERT_AUTH_STATE steps. Paths, selectors and fixture values are enumerated; arbitrary JavaScript, URLs, selectors or generated Playwright code are rejected. Recompilation rejects edits even when an altered step is schema-valid. The plan is bound through the existing run/bundle to project, invariant/version, deployment, authorization, logical identity, seed, source digest and original oracle.

Thirteen journeys cover signup, login, protected routes, paid access, logout, create/read/update, invalid credentials, expired sessions, server errors, missing input, missing entitlement, exhausted AI quota and release regression. Before judgment, a separate authenticated paid control must reach the dashboard and paid feature. A globally broken app is INCONCLUSIVE. Assertions record selected visible markers and trusted server state. Cosmetic copy changes do not fail a business invariant; exact text is used only for the explicitly registered created/updated record values.

The release scenario starts from a working fixture, introduces a broken login redirect, reproduces the journey failure from fresh sessions, persists a finding, replays the fixed version and retains a native regression artifact. Browser business regressions are not generic screenshot/visual comparisons.

## Network and evidence safety

The existing Phase 4 signed grant must authorize the reserved Reference Lab target. A dedicated local mapping assigns the fresh loopback origin and scope key. Every browser request must match that exact origin and a registered path. Redirects are fetched without automatic following and their Location is validated; external origins, alternate ports, credentials, unexpected paths and query strings are blocked. Playwright does not reroute automatically followed redirect hops, so the interpreter replaces an approved 303 with an inert intermediate page and navigates to its validated GET destination explicitly. Each hop is separately authorized and charged, with a three-hop bound. Original 303 status and final path remain evidence. Other redirect semantics are unsupported; native browser redirect behavior is not certified. Scope headers are added only after validation. WebSockets are closed and service workers are blocked. Production TargetClient/SSRF rules remain unchanged.

Each network operation consumes the existing request budget. Original/reproduction share 128 requests, 180 seconds and 200 browser actions; each trace has at most 100 actions and 90 seconds, with a 45-second journey step budget. Individual navigation/action/observation timeouts are bounded. HTML responses are capped at 8 KiB and evidence at 64 KiB. Admission persists selected paths, statuses, assertion booleans, safe business state and console severity classes. It records no full DOM, cookies, credentials, console text, network bodies, trace videos or screenshots; screenshot capture is deliberately disabled under SELECTED_MARKERS_ONLY policy.

Navigation routing is a controlled-test safety boundary, not OS egress isolation for untrusted applications. No arbitrary customer targets or browser scripts are supported. Playwright documents the need to [block service workers when routing requests](https://playwright.dev/docs/network); this configuration also rejects WebSockets explicitly.

## Setup, cleanup and CI

Use the pinned lockfile with `npm install`, then `npm run browser:install`. CI explicitly runs `npx playwright install --with-deps chromium --no-shell`; no provider credentials are needed. Run `npm run test:browser-journey`, `npm run test:browser-regression`, and the full `npm test`. Missing binaries produce inconclusive execution, causing expected-PASS tests to fail; they are not silently skipped.

Contexts, browser processes and fixture sessions are closed after success, failure, reproduction, cancellation, timeout and controlled browser disconnection. New attempts get fresh cookies and storage. The declared crash fault closes the browser connection deliberately; it is not host process-crash recovery certification.

Set `LAUNCHGATE_REQUIRE_DATABASE=1` and run `npm run test:phase7-e2e` for the complete disposable PostgreSQL/PostgREST rehearsal: six AI journeys plus a full baseline/regressed/fixed/reintroduced browser release chain. Existing Phase 5/6 journeys run too. Exact local results and limitations belong in the [acceptance ledger](v1-acceptance.md).
