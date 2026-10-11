# Static architecture and invariant discovery

Phase 3 emits `STATIC_OBSERVATIONS`, never PASS, REPRODUCIBLE_FAILURE, BLOCK, VERIFIED or attestations. Confidence is LOW/MEDIUM prioritization metadata only. Static proposals do not call the Phase 1 verification/gate engine.

## Deterministic analysis

Supported stack signals cover Next.js, React, Supabase, PostgreSQL, Stripe, Razorpay, Vercel, OpenAI and Anthropic. Manifests and parsed import declarations are deterministic positive observations. Vercel JSON is parsed as data. Route layouts are weaker structural signals. SQL is conservatively labeled a dialect candidate. Output is DETECTED / NOT_DETECTED / AMBIGUOUS with source file/digest/blob SHA/line provenance. A declaration is evidence of declared architecture, not proof that an SDK call runs in production. Missing/incomplete source cannot confidently establish absence.

The TypeScript/JavaScript parser visits syntax trees without executing code. Observations include routes/pages/middleware, client directives, database clients, table calls, tenant filters, role/auth/plan/quota checks, payment calls/webhooks, AI calls and credential/service-role environment references. Helper names and identifiers are candidates, not resolved business semantics. Aliases, dynamic imports, wrapper functions, interprocedural control flow, generated code, server-action semantics and custom frameworks are not fully resolved.

Migration SQL is lexical observation only: tables, tenant columns, RLS enablement/policies, SECURITY DEFINER and grants/revokes. Comments are reduced, but no SQL dialect parser or policy-security proof is claimed. ENABLE ROW LEVEL SECURITY does not establish that policies isolate tenants. Billing observations likewise do not prove captured-payment validation, amount integrity or refund correctness; AI observations do not prove budgets are reserved atomically.

Nodes retain source provenance. Edges explicitly mean `CONTAINS_OBSERVATION` within a source route/page/migration; they do not pretend to prove calls/protects relationships that were not resolved. Snapshot ID, immutable commit and analysis version are enforced by the persistence parent. Strict report validation checks hashes against ingested files, graph references and bounded result sizes. No raw snippets are needed for provenance.

## Proposal registry

An extensible family registry maps observed node kinds to seven initial domains:

| Domain | Proposed boundary |
| --- | --- |
| tenant_isolation | Members cannot access another organization's resources |
| authorization | Members cannot grant themselves owner/admin privileges |
| billing | Failed/unverified payment cannot grant entitlement |
| webhooks | Replayed payment event cannot duplicate entitlement effects |
| paid_features | Free users cannot invoke operations designated paid-only |
| ai_cost | AI usage stays within server-controlled budgets/limits |
| authentication | Anonymous callers cannot access actions designated authenticated |

Every proposal includes a stable analysis-local key, statement, rationale, source evidence, assumptions, LOW/MEDIUM confidence, PROPOSED status and mandatory confirmation. Public routes may legitimately exist; the auth proposal asks which actions require authentication instead of declaring all routes private. Filename/identifier-only observations remain explicitly ambiguous. Fixtures cover all seven families and ambiguous policies, as well as five representative stack combinations.

## Review and future execution

OWNER/ADMIN may CONFIRM, REFINE, REJECT or DEFER through the backend API. Every action appends an immutable numbered review; retries with the same request key/input deduplicate, conflicting reuse is rejected. Source proposals remain immutable. User review cannot replace provenance, switch snapshots or manufacture a dynamic verdict. Review statements are checked for likely secrets at the HTTP boundary and bounded in SQL.

A confirmed statement is a versioned policy decision, not an executable Phase 1 invariant specification. Fixture actors/resources, applicability, registered operations and deterministic assertions still require later refinement. No fake fixture bindings are invented here.

No model provider is invoked in Phase 3, so no source is submitted to Anthropic/OpenAI and no model key is required. Repository prompts/instructions cannot alter system behavior. A future model adapter must receive minimal redacted evidence as DATA, validate structured proposals against the same provenance boundary, retain uncertainty and never gain execution/proof authority. The strict static report schema rejects added verdict fields today.
