# LaunchGate Verified badge

An administrator explicitly enables public assurance in project settings. Public
GitHub visibility alone never enables it. Customer projects require a connected
public repository; controlled Reference Labs may opt in and remain labelled as labs.
The generated random slug is unrelated to sequential project IDs. Disabling public
assurance immediately makes the page and SVG unavailable.

The README snippet is displayed only after enablement and links to `/assurance/slug`,
with an SVG from `/api/public/badges/slug.svg`. The SVG has a fixed layout and fixed
state vocabulary, no raw user SVG, script, external content or arbitrary labels.
Responses use no-store, nosniff and a sandboxed content policy.

States: VERIFIED, BLOCKED, INCONCLUSIVE, STALE, NOT_CONFIGURED. VERIFIED means
**Release Policy Satisfied** for the represented release and tested scope.

Projection selects the newest candidate and its current evaluation generation.
Missing evaluation on a superseding candidate, non-decided state, expired evidence,
a newer policy version, or changed enabled release configuration makes it stale.
For customer projects, the server re-resolves the public repository's current
default-branch SHA and requires an exact match. Provider failure or lost public
visibility cannot return green. No client supplies the trusted head SHA.

Reference Lab projection uses its controlled candidate/policy history, not a customer
default branch. It must never be presented as customer production qualification.

Public assurance explains that verification is scoped and time-dependent. It does
not imply absolute or permanent security. No badge is generated from static analysis.
