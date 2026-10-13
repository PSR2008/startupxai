# Reproduction, fixed replay and regression

Exact replay means the same invariant/version, operation, logical actors/resources, assertions, sequence, seed and fixture recipe, provisioned with fresh valid credentials and IDs. Expired tokens and stale UUIDs are never replay inputs.

The first candidate and second attempt share one grant/request reservation. The control plane accepts REPRODUCIBLE_FAILURE only after both have working controls, observable state, confirmed cleanup, matching logical initial-state digest and the same normalized failure signature. A single violation, second PASS, different failure signature or failed reproduction cannot create a reproduced finding.

The sealed reproduction bundle contains run/project/organization, attempt/fence, invariant/version, family/version, source identity, deployment, authorization/version, full immutable plan/hash, seed, logical bindings, safe registered request, oracle, before/after/observation hashes, request counts, durations, concurrency, cleanup, repetition count/status and Evidence manifest. It references a private immutable trace artifact by digest/size/storage reference. Raw sessions, scope capabilities and unrestricted response bodies are excluded.

Fix replay selects a registered variant of the same lab family and creates a fresh scoped target. It reuses the originating plan and positive controls. PASS resolves the finding only within that replay scope. A feature-breaking fix whose authorized control fails is INCONCLUSIVE, never RESOLVED. Reintroducing the vulnerability produces REGRESSION_FAILED.

The LaunchGate-native regression artifact is durable JSON: originating finding/invariant, plan version/hash, logical bindings, oracle, fixture applicability, source/deployment provenance and expected PASS. It does not generate or execute repository tests. The replay endpoint is its controlled execution path. Fresh local source changes require a newly registered source identity; old grants cannot silently execute changed harness code.

The automated database journey creates a synthetic organization/project using authenticated commands, registers the lab target/authorization/confirmed invariant/plan, schedules it through Phase 4, provisions and repeats the vulnerable case, seals evidence and finding, replays the fixed build, reintroduces the vulnerable build and verifies the fixed build again. It uses no manual database edits for this journey. Separate RLS tests deliberately attempt forbidden privileged/browser mutations and verify isolation.
