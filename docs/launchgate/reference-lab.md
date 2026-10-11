# LaunchGate Reference Lab

The Reference Lab is a first-class verification oracle and regression corpus. It is not customer evidence or a demo presented as a verified service.

Every fixture family has a version, domain, deterministic seed, logical identities, setup requirements, oracle and three distinct identities: vulnerable, fixed and deliberately inconclusive. `referenceFixtureSchema` validates these contracts. Initial families:

| Family | Vulnerable observation | Fixed observation | Inconclusive setup |
| --- | --- | --- | --- |
| Tenant isolation | Foreign tenant marker readable/writable | Marker denied and state unchanged | Owner positive control cannot read fixture |
| Privilege escalation | Member becomes owner | Role unchanged | Role state unavailable |
| Paid-feature bypass | Free actor uses paid operation | Operation denied without effect | Plan/actor cannot be provisioned |
| Payment entitlement integrity | Failed payment grants entitlement | Zero grant | Provider safe-mode state unavailable |
| Webhook duplicate/replay | Repeated event doubles effect | Exactly one effect | Event observer unavailable |
| AI quota/cost bypass | Disallowed call incurs provider usage | No call/spend | Provider usage cannot be observed |
| Distributed/race-safe usage | Concurrent requests exceed reservation | Atomic ceiling holds | Barrier or shared store unavailable |
| Auth/session boundaries | Anonymous/expired actor crosses protected boundary | Access denied | Session positive control fails |

Phase 1 implements **pure synthetic semantic cases**, using bounded values and in-memory manifests. These tests do not run HTTP, payments, databases or adversarial customer operations. The runner digest and artifact hashes are explicitly synthetic contract test inputs, not artifacts from real execution. Each family exercises vulnerable → REPRODUCIBLE_FAILURE, fixed → PASS, unobservable → INCONCLUSIVE. Shared fixtures live in `tests/fixtures/launchgate.ts`; semantic suites are `tests/launchgate-reference-lab.test.ts` and `tests/launchgate-gate.test.ts`.

Later phases implement executable fixture apps with paired source revisions, independent reset/provision/observe/cleanup adapters, known role/tenant/plan state, deterministic scheduling barriers and real artifact digests. Each family must exhibit the exact same oracle on vulnerable and fixed variants. Tests must fail on vulnerable code, pass on fixed code, and become inconclusive when observability/positive controls break. Never modify an oracle solely to make a fix pass.

Reset uses logical identities and seed, never production data. Replay requires a fresh attempt with matching pre-state, plan, scope and failure signature. Time-sensitive policies require a controllable clock or documented tolerances. Payment cases use provider safe modes; AI cases use bounded provider simulators for regression and separately authorized provider contract checks. A simulator proves only its modeled boundary.

A REFERENCE_LAB candidate/admission cannot approve a CUSTOMER_VERIFICATION candidate. Promotion to customer verification requires a future authenticated evidence-ingestion service. Exported TypeScript admission types do not implement cryptographic authentication. No deployed fixture application, runner, signed attestation, provider integration or customer verification is implemented in Phase 1.
