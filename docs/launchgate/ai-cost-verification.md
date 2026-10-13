# AI cost verification — Phase 7

Phase 7 executes only operator-owned Reference Lab fixtures. `SYNTHETIC_OPENAI_LIKE` and `SYNTHETIC_ANTHROPIC_LIKE` providers perform deterministic local calculations, with no SDK, credential, provider URL or network capability. **Real financial spend is zero.** Neither adapter certifies live OpenAI/Anthropic compatibility.

## Execution and evidence

The existing immutable compiler, Phase 4 grants/request accounting, Phase 5 control-plane outcomes and Phase 6 policy patterns are reused. Twenty-five AI programs cover anonymous access, body/query/endpoint model overrides, permitted paid access, quota, pre-provider reservation, ten-client races, organization limits, fixed-window rates, distributed limits, cost, expensive endpoints, bounded input/batch/depth abuse, provider failure and quota reset.

A separate paid positive control must call the permitted premium model and record one reservation before invocation, committed usage, reconciled synthetic cost and no outstanding reservation. Adversarial operations run only after the control plane accepts it. The collector observes actual HTTP responses and private SQLite state. The oracle compares provider invocation count, user/organization committed usage, reservation ordering/count, outstanding reservations, model choice, committed cost and rate state. A 429 after provider invocation remains a violation. A 200 alone proves neither success nor failure. Missing reliable observations, provider timeout, failed controls and cleanup uncertainty are INCONCLUSIVE.

Provider records normalize model, input/output units, synthetic actual/maximum cost, request UUID, success and deterministic latency class. Sequence numbers expose reservation-before-provider ordering. Small-model requests reserve input + two possible output units and reconcile to input + one actual output unit; premium cost doubles those units. Client estimates are ignored. Failed-call policy explicitly chooses NOTHING or RESERVED_ONLY. These are fixture contracts, not estimates of actual commercial prices.

## Policy

The version-one Reference Lab operator confirms the policy. It declares user and organization limits, reset period, no rollover, free-small/paid-premium model availability, fixed rate window and burst, per-request and organization cost limits, failure accounting and input/batch/depth ceilings. UNKNOWN policy returns REQUIRES_CONFIRMATION without operations. LIVE mode stops independently of target authorization.

Default user quota is five; special registered organization/rate programs use explicit policy overrides. The compiler accepts only these registered policy combinations plus the two declared failed-call policies, avoiding a catalog oracle being applied to an arbitrary customer limit. Cost budget and quota reset after 100 logical units. Inputs are bounded synthetic counts (maximum 32), never large real prompts. Unsupported algorithms, policies and provider states are not inferred.

## Findings, replay and source correlation

Blocking failures require fresh fixture state and identifiers, the same seed/policy/program and matching deterministic failure signature. Original-plan fixed replay must preserve valid paid usage. Native expected-PASS artifacts catch reintroduced anonymous, model, reservation, concurrency, distributed-rate, organization-budget and endpoint-cost defects.

`bindConfirmedAiInvariant` is an internal mapping helper for a stored, confirmed Phase 3 source-analysis invariant. It requires an explicit registered AI case and confirmed fixture policy, retains source invariant/version/digest and returns a Reference Lab plan. It does not authorize customer deployment testing, automatically execute static suspicions or expose a browser write API. The caller must load the source confirmation under project authorization. No production source-discovery UI was added.

## StartupX dogfood

Read-only inspection of `src/app/api/analyze/idea/route.ts` shows `analyzeIdea` before `recordAnalysisUsage`; the latter can return a limit response after work. An isolated Anthropic-like fixture reproduces that behavior, then passes with reservation before invocation. `src/lib/rate-limit.ts` uses process-local LRU state; the distributed fixture models its bypass across logical instances. Production StartupX routes are unchanged and never invoked during verification.

AI/browser plans share 128 requests and 180 seconds across original/reproduction, with 64 KiB evidence. AI bounds are 80 provider operations, 4,000 synthetic token units and 8,000 synthetic cost units; real spend is always zero. Traces retain safe selected state and fresh synthetic identifiers, not prompts, keys or raw provider payloads. Counter totals are observation-derived; missing observations are inconclusive, not evidence of zero provider work. See [quota transactions](quota-verification.md), [browser journeys](browser-journeys.md) and [acceptance results](v1-acceptance.md).
