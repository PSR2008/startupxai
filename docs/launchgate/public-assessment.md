# Public static assessment

`/assess` accepts `owner/repository` or an HTTPS `github.com/owner/repository` URL.
It recommends dynamic verification and links into ordinary project onboarding.

**Static analysis only. Runtime business invariants have not yet been proven.**

Anonymous requests cannot invoke verification workers. GitHub requests use no
credential, only fixed `api.github.com` endpoints, and reject redirects. Private,
missing and inaccessible repositories return safe unavailable responses. Canonical
repository ID and default-branch commit are resolved before reading an immutable
tree. Public visibility is checked again on every assessment request, including
cache hits.

Limits: repository metadata size 20 MiB, tree 2,000 entries, at most 24 blobs and
30 GitHub requests, 64 KiB per blob, 2 MiB admitted content, 30-second network and
ingestion bounds, existing five-second resource-limited parser. Archives, binaries,
generated/vendor content, unsafe paths, symlinks and submodules follow Phase 3 rules.
No clones, installs, scripts, tests, executable configuration or repository imports.

The cache key contains canonical repository ID, exact SHA, analyzer version,
schema version and public bound-policy version. Cached results contain safe
observations, never source snippets or raw architecture evidence. Entries expire
after seven days. Mutable branch resolution precedes cache lookup so advancing
branches cannot return an old branch-only cache result.

Database-backed admission allows ten assessments per client per hour and one
hundred globally, with two active analysis leases. Claims deduplicate concurrent
work; expired leases can be reclaimed. Provider backoff lasts one minute. On
Vercel, the trusted overwritten proxy header is HMACed for quota identity; other
deployments conservatively share one quota rather than trusting spoofable forwarded
headers. These hard quotas are the initial bot-cost strategy; managed edge bot
protection should be configured before production qualification.

Outputs use static observation statuses and never SHIP/BLOCK/VERIFIED. Unsupported
or partial coverage is visible. Public telemetry stores only daily event counts;
DNT and Global Privacy Control suppress event counting.

The Vercel proxy-header boundary follows the
[official request-header contract](https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for);
other hosting setups use the shared conservative identity until their proxy is qualified.
