# Safe source ingestion

Source is untrusted data. `@launchgate/source-analysis` uses Node cryptography/worker threads and TypeScript 5.9.3 syntax parsing only. There is no repository checkout, archive extraction, filesystem materialization, module resolution, configuration execution, package manager, build, test, eval or shell invocation. Import strings are observations, never modules to load. Customer files never enter Next/PostCSS/Tailwind or the control-plane build directory.

## Immutable identity and limits

A requested snapshot binds organization/project/connection, a full lowercase 40-character commit SHA and analysis version `lg-static-1`. Branch/PR labels are deliberately unsupported. QUEUED/UNFETCHED means the SHA is requested, not yet provider-verified. Ingestion retrieves the exact commit and tree through a repository-scoped token, checks returned SHAs and validates each blob's Git SHA-1 over its actual bytes. Persisted file SHA-256 digests provide additional content provenance. Snapshot status becomes COMPLETE only after transactional publication.

| Ceiling | Default / hard maximum |
| --- | --- |
| Recursive tree entries | 2,000; truncated trees rejected |
| Fetched files | 200 |
| Individual file | 64 KiB |
| Total fetched bytes | 2 MiB |
| Path length / depth | 240 characters / 20 segments |
| Provider response | 2 MiB; webhook 256 KiB |
| Ingestion / provider request | 30 seconds overall / 10 seconds each |
| Parser worker | 5 seconds; 128 MiB old generation, 16 MiB young generation, 4 MiB stack |
| Parsed nodes / edges persisted | 4,000 each |

The pure ingestion API permits lower limits, never higher ceilings. A single selected application root may be used for monorepos; other paths are explicit coverage exclusions. Git tree, body and parser limits fail closed. Source bytes stay in process memory until the job ends; they are not written to database/object storage. Garbage collection is not guaranteed memory zeroization.

## Paths and classification

Paths must be conservative ASCII relative Git paths. Absolute paths, drive/device names, backslashes, percent encodings, alternate streams, traversal/dot/empty segments, trailing dots/spaces, Unicode deception, `.git`, excessive depth/length and case-fold collisions are rejected. Unsafe names are represented by a hash in coverage rather than copied into diagnostics. Symlinks and submodule modes are excluded without fetching their content. Archives are never expanded. This intentionally excludes some valid Git filenames rather than attempting unsafe platform-dependent normalization.

UTF-8 decoding is fatal on malformed bytes. NUL/control-byte detection prevents binary files masquerading as text. Classification distinguishes source, configuration, migration, manifest, generated, binary, media, lockfile, documentation, tests and unknown. Vendor/generated directories (`node_modules`, `.next`, `dist`, `build`, `coverage`, `vendor`, `generated`) are excluded before blob reads. Other ignored classes have metadata and explicit coverage reasons but no parser text. Tests/docs do not create production architecture observations.

Skipped paths/reasons, parsing failures, non-executed lifecycle scripts and unsupported structures are explicit. COMPLETE coverage only means complete within this bounded static scanner, never full program coverage or security assurance. Malformed manifests/source produce PARTIAL analysis coverage and ambiguous absence conclusions. Limits can reject an entire job; failures are safe codes, never raw compiler/provider exception text. Root and read-count limits apply before network fetching, with actual bytes and hashes checked afterward.

## Secret and parser boundaries

Likely provider keys, bearer tokens, JWTs, PEM private keys, database connection strings and common secret assignments are redacted before parser worker transport. Newline counts are preserved for provenance. No snippets, arbitrary identifiers, raw diagnostics or source bodies are persisted in reports. Secret-like paths are rejected; ordinary safe paths and content hashes remain visible only to tenant members. Redaction is heuristic and does not promise detection of custom encodings, split keys or every secret format.

The parser worker has an empty environment and receives only bounded redacted files/metadata. It uses `createSourceFile`, not a compiler host or `createProgram`. The parent enforces a wall-clock timeout and validates the complete strict report schema and every source hash reference. Worker threads limit resource consumption; they are not a general OS security sandbox. No untrusted instructions are executed, and no dynamic runner is implemented.

## Persistence and rehearsals

Forward migrations 016/017 add nine public tables: installations, verified repository inventory, connections, snapshots/job metadata, source-file metadata, architecture reports, invariant proposals, review versions and provider inbox. One private hashed setup-state table is needed for one-time authorization. Architecture nodes/edges/integration signals and proposal evidence are bounded JSON inside immutable snapshot/proposal records rather than separate speculative graph tables. Composite tenant/project/snapshot FKs and trusted provenance validation preserve ownership. All new tables force RLS; browser DML is denied. The private state table has no browser reads; snapshot leases have no browser SELECT grant.

The disposable test suite first rehearses 001-015 and the original 59 Phase 2 cases, then applies 016/017 and source-security cases. It uses PostgreSQL 17 and PostgREST with synthetic Auth SQL semantics, no production URLs, no mounted source and no published ports. It is not an exact hosted Supabase rehearsal. Supabase CLI is absent; exact Supabase schema type generation is **BLOCKED_BY_ENVIRONMENT**. Existing narrow manual types plus validated runtime schemas remain temporary; no generated output was fabricated.

Retention/deletion execution remains a Phase 4/later obligation: include snapshots, metadata, reports, setup nonces and integration inbox in retention tasks. No source bytes are stored, but repository paths and architecture are still private customer metadata. RLS stops ordinary access when the organization is pending deletion. No complete erasure or backup-expiry claim is made.
