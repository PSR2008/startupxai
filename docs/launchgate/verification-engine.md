# Dynamic verification engine — Phase 5

Phase 5 executes only LaunchGate-controlled Reference Lab applications. Static proposals are not dynamic proof. A candidate violation is not a reproduced failure. A reproduced failure demonstrates the recorded invariant violation within the recorded scope; it is not a universal security statement. PASS is scoped to the plan, identities, state, deployment and authorization. INCONCLUSIVE is a valid result when the necessary evidence cannot be established.

## Plan and execution boundary

`reference-lab/plans.ts` compiles the existing InvariantSpec with confirmed logical bindings and fixture capabilities. It rejects model/proposed invariants, unsupported bindings, changed assertion definitions and unregistered operations. The immutable plan includes invariant/version, fixed case, family/version, seed, logical actor/resource, mandatory preconditions, controls, observation/cleanup requirements and budgets. Admission recompiles and hashes it; the runner cannot replace its oracle.

The operation registry supports six authentication cases (API, route, action, invalid token, deterministic expiry, logout), three tenant cases (read, write, delete using substituted object IDs), and four privilege cases (member to owner/admin, viewer to developer, developer to owner). Delete is a registered resource.write case, not a new arbitrary operation. Role cases exercise direct API role-field mutations. The action is a synthetic HTTP action with observable state change, not a Next server-action framework integration.

No shell, SQL, JavaScript, arbitrary URL or generated HTTP program is accepted. The local provider implements Phase 4's RunnerProvider; jobs, leases, one-time signed grants, current authorization checks, fencing, cancellation, cleanup and budget reservation remain Phase 4 mechanisms. The grant binds the exact lab plan, seed, variant and source digest. Customer grants retain their previous transport restrictions.

## Controls, collection and decisions

The collector sends a fixed sequence: health, control before state, authorized operation, control after state, adversarial before state, registered operation and adversarial after state. Logout/expiry adds the fixed session invalidation operation. The control plane approves the negative step only after the positive control succeeds. Controls prove the corresponding authorized data access or mutation still works.

The runner returns schema-bound observations, never a policy verdict. Stored observations contain selected marker/status, logical ownership/tenant/role, resource existence/value, fresh synthetic mappings, state digests, timing, request count and cleanup result. Session tokens, scope keys, headers and arbitrary response bodies are excluded. Responses are limited to 8 KiB; traces and persisted evidence have independent bounds.

`reference-lab/evaluation.ts` deterministically recomputes the controls, visibility and whole selected before/after state equality. It reuses the existing Evidence schema and verification-core outcome evaluator. A 403 with a side effect is a violation; a sanitized 200 is not inherently a failure. A masked 404 passes only with a working positive control and unchanged observed state. Failed controls, missing credentials, timeout, unavailable observation, runner errors and uncertain cleanup prevent PASS or reproduced failure.

First violation produces a candidate. The host disposes the fixture and repeats the same plan against fresh state/IDs/sessions. Both attempts must establish the same logical starting-state digest and normalized failure signature. A second PASS, different violation or infrastructure failure yields INCONCLUSIVE. One unconfirmed attempt cannot produce REPRODUCIBLE_FAILURE.

## Budgets and provenance

Original plus reproduction share at most 32 requests, a 60-second grant and concurrency one. Health, observation and control requests are charged before I/O. The host uses 500 ms pacing; PostgreSQL independently enforces the Phase 4 two-requests-per-second ceiling and organization reservations. Fast unit harnesses explicitly substitute local pacing; the real database journey uses normal pacing. Trace artifact bytes are capped at 64 KiB and recorded alongside duration/request usage. Disposal runs in finally on success and failure.

Source identity is SHA-256 over the controlled lab source files. The existing deployment commit_sha field holds a SHA-1 content revision for this explicit REFERENCE_LAB provider; it is **not a Git commit**. No container image digest is invented. A source digest substitutes for image identity only in trusted REFERENCE_LAB admission, never production admission. Evidence is sealed in the control plane and stored through the existing private artifact adapter and manifest tables.

Run `npm run test:lab-runtime`, `test:auth-dynamic`, `test:tenant-dynamic`, `test:role-dynamic`, `test:reproduction`, `test:fix-replay` and `test:regression`. These suites are included in `npm test`.
## Phase 6 billing extension

The existing compiler and evaluator also dispatch the 27 registered billing cases. Billing plans alone use a shared original/reproduction budget of 64 requests, 120 seconds, 16 event deliveries, 20 provider operations and zero financial spend; concurrency is one except the explicit two-delivery race. Phase 5 authorization cases retain their 32-request/60-second budget. Positive captured controls, confirmed policy, actual state/paid access, fresh reproduction and original-oracle fixed replay are mandatory. See [billing verification](billing-verification.md).
