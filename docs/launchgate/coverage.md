# Explicit coverage and freshness

Every policy requirement has one item: PASS, REPRODUCIBLE_FAILURE, INCONCLUSIVE, NOT_APPLICABLE, NOT_RUN or STALE. The snapshot separately counts required total, applicable total, passed, failed, inconclusive, not run, stale and not applicable. Advisory entries remain visible without inflating required counts. There is no security score.

NOT_APPLICABLE requires a confirmed invariant and explicit applicability proof bound to the candidate commit/snapshot. It is never PASS. An all-not-applicable policy cannot approve a release. Missing and duplicate submissions cannot approve. A waiver is recorded alongside the original item, with its ID in the evaluation provenance.

Evidence must match organization, project, exact commit, deployment, policy identity/version, evidence scope, purpose, invariant/version, runner version, test version, fixture version and plan hash. It must be within the policy freshness window, not future-dated, and maintain attempt chronology. Target authorization and ownership proof must remain valid and unrevoked. The service verifies the sealed reproduction bundle digest, run/authorization binding and registered plan before admitting its evidence. The existing deterministic evaluator verifies controls, assertions, artifact redaction and fresh reproduction.

Changing commit, deployment, policy, invariant, runner, test or plan prevents automatic evidence reuse. An invalid candidate/environment binding prevents both approval and a vulnerability BLOCK decision. Failed controls, missing credentials, crashes and unobservable browser journeys remain incomplete assurance.

Evaluation history records exact coverage, manifest references, policy digest/version, considered findings/regressions, applied exceptions, reason codes, engine version and timestamp. Re-evaluation appends a new generation. Previous coverage and decisions cannot be rewritten by browsers or ordinary updates.

A SHIP evaluation records `validUntil`, bounded by evidence age, authorization expiry and applied exception expiry. The running release worker detects expiration and schedules a new generation; a GitHub-backed generation starts with non-approval. GitHub checks do not have a native expiry timer. Worker/provider outages can delay that external update, so operators must monitor the worker and require a fresh rerun when validity has elapsed; the historical SHIP record is not continuing assurance.

Focused commands: `npm run test:coverage`, `npm run test:stale-evidence`, `npm run test:gate-engine`, `npm run test:cross-domain-release`.
