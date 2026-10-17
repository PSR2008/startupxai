# Production execution boundary

Status: **PRODUCTION_SANDBOX = BLOCKED_BY_ENVIRONMENT**. No dedicated assets or
budget were provided; the user explicitly selected local readiness testing.
No cloud sandbox was provisioned. Node contract tests and local Docker do not
prove OS isolation. No arbitrary customer build, install or test command is enabled.

`services/production/contracts.ts` defines the replaceable provider interface:
createSandbox, injectScopedCredential, configureEgressPolicy, startExecution,
heartbeat, streamEvents, terminate, destroy, getUsage and getAttestationMetadata.
`ProductionSandboxRunner` adapts this to the existing Phase 4 RunnerProvider.
Its only executable operation is `launchgate-controlled-verification` from a
pinned image digest. Provider SDK/HTTP transports remain unimplemented until a
backend and account can be reviewed. No environment variable pretends to supply one.

The adapter persists an exact environment/org/run/attempt resource intent before
provisioning. Create/start must reconcile the same idempotency key; terminate and
destroy must also accept that key after an ambiguous create timeout. Provider
operations must have bounded timeouts. Fencing and authorization are checked
before injection. Provider failures expire the resource and cannot finalize PASS.
The existing evidence ingestion and release gate remain the assurance authority.

LaunchGate checks exact scope, image and policy digests, attestation freshness,
short-lived grants, test-only zero-spend operations and a fixed execution command.
Attestation metadata is trusted adapter output; it is not independently measured
hardware attestation. The provider must authenticate/validate its infrastructure
proof before returning it. Supervisor checks heartbeat and measured resource use;
the infrastructure must enforce ceilings even while the control plane is offline.

## Infrastructure obligations

One attempt per isolation boundary; no host Docker socket, devices, privileged
processes or host namespaces; no ambient cloud identity; no shared writable mount;
no public listener. No database credential, GitHub App key, global Vercel token,
billing secret or unrestricted environment inheritance. Read-only source where
needed; ephemeral `/scratch` only; deny symlinks and enforce path confinement
with OS primitives. Maximum: 32 processes, 128 file descriptors, 256 MiB scratch,
512 MiB memory, one CPU and 900 seconds. Node path checks alone do not enforce this.

The provider's external network gateway must deny by default, allow only the
authorized HTTPS hostname on port 443, resolve and validate every IPv4/IPv6
answer, pin connections, deny metadata/private/link-local/loopback destinations,
revalidate every subresource and deny redirects. `authorizeDestination` supplies
shared policy checks; the existing TargetClient already performs pinned HTTPS.
Merely configuring a policy object does not prove enforcement. No provider API
egress is granted to runners; GitHub and deployment operations remain mediated.

## Provider spike, reviewed 2026-10-16

| Option | Evidence and required qualification | Decision |
| --- | --- | --- |
| AWS Fargate task | Hardware-virtualized task boundary and task ENI; CPU/memory configuration. Needs a dedicated account/VPC, enforced DNS-aware egress proxy, no task identity and metadata denial. | Candidate, not selected/provisioned |
| Cloud Run job | API-controlled jobs with task timeouts, resource settings and VPC egress. Network controls alone do not establish the required hostile-workload boundary or eliminate service identity/metadata. | Candidate requiring isolation review |
| Dedicated microVM fleet | Operator can design per-attempt VM, isolated scratch and gateway. Kernel/image patching, API authentication, capacity and destruction become operator responsibilities. | Design option only |

AWS documents [task isolation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security-fargate-ec2.html),
[task networking](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-networking.html),
and [metadata endpoints](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-metadata-endpoint-v4-fargate-examples.html).
Google documents [job execution](https://docs.cloud.google.com/run/docs/execute/jobs)
and [VPC egress](https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc).
These are provider documentation, not local qualification evidence.

For every candidate, startup latency, teardown latency, regional availability,
account concurrency, quota behavior, log visibility, credential injection and
total cost remain **UNVERIFIED**. Benchmark one dedicated nonproduction attempt
only after an approved region, hard budget and account are supplied. Record cold
start/stop percentiles, denied egress, resource-limit kills, no cross-run persistence,
revocation and cleanup after control-plane outage before choosing a backend.
