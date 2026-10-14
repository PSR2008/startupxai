# Conservative impact and regression selection

The selector compares exact base/head snapshot file digests and validates Phase 3 architecture provenance against those files. It correlates changed paths with graph nodes rather than trusting diff text or branch labels. It records added, modified, deleted and renamed files.

Authentication changes select auth/authorization/tenant/protected journeys; payment/webhook changes select billing/webhook/entitlement; quota/AI changes select cost/concurrency/rate checks. Shared middleware, migrations/RLS, privileged database clients, credential boundaries, dependency manifests, structural route changes and unknown changes broaden selection. Missing base, invalid provenance, partial coverage, exclusions and diagnostics also broaden it.

Required coverage and mandatory baselines always remain selected. Selective omission is limited to advisory requirements with complete persisted unchanged dependency proof. A UI-only change may omit such advisory work while retaining baseline and related journeys. Unknown/incomplete dependencies select the suite. Resolved critical findings and recent/unresolved findings retain priority. The worker's automatic initial mappings cover the entire analyzed file/node set, deliberately conservative; bounded or partial mappings remain incomplete. Trusted operators can persist narrower confirmed mappings through the fenced service command.

Invariant and regression dependency records contain snapshot identity, invariant version, files/digests, graph nodes, dependency kind, completeness and provenance digest. Kinds cover files, routes, tables, policies, payment, AI, quota and journeys. Carry-forward finding applicability requires matching complete origin/head provenance. A failed proof results in unresolved assurance, never assumed resolution.

Selection is optimization only. Unchanged files never make stale run evidence fresh. The selection snapshot stores IDs, reason codes, priority, estimated request units and a digest; the release state stores actual requests and duration after evaluation. No pricing or model decision authority is introduced.

Focused commands: `npm run test:impact-analysis`, `npm run test:regression-selection`.
