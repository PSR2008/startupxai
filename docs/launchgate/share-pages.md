# Shareable release assurance

Evidence is private by default, including projects connected to public repositories.
An administrator explicitly confirms **Share release** on a release detail page.
The confirmation explains that anyone with the link can see sanitized assurance.
An optional expiry can be set; settings allow revocation at any time.

Each share references one immutable gate evaluation, thereby binding its release,
policy version and evaluation timestamp. New releases do not rewrite that evaluation.
Expired SHIP evidence is identified as stale historical evidence, not current approval.

Share secrets contain 256 cryptographically random bits. Only SHA-256 hashes are
stored. The raw link is returned once at creation, is not listed later, and grants
no dashboard, source, finding-detail, team or general API access. CI credentials
cannot create shares. Invalid, expired and revoked shares have the same unavailable
response; public routes are quota-protected and no-store.

Public projections are built in a trusted database function from authoritative
records. Fields are limited to display identity, reference-lab purpose, release and
evaluation identity, commit, decision, configured policy version, coverage counts,
evaluation time, evidence expiry and engine version. Explanations are fixed strings.
No raw evidence, request body, exploit, source snippet, architecture or credential is
projected. React renders text rather than HTML. The share page uses no-referrer and
no-index metadata; operators must also redact share-token paths from access logs.

SHIP means release policy satisfied for the tested scope. BLOCK means reproducible
policy-blocking failures. INCONCLUSIVE means required assurance could not complete.
This is not absolute or permanent security certification. V1 does not expose detailed
finding shares or a machine-token sharing capability.

LaunchGate shares use `/assurance/share/token`. The existing StartupX `/share/token`
route is preserved independently.
