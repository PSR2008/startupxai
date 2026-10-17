# Key rotation

RunnerKeyRing supports Ed25519 key IDs, current signing key, bounded old public-key
overlap and immediate revocation. Existing grants still have their original short
expiry. Distribute the new verification key before switching the signer; remove
old verification authority after the transition. Never retain old private keys
in runner configuration. Tests cover overlap, expiry and explicit revocation.

ManagedSecretStore defines put, lease, rotate, revoke and delete. Reference
metadata binds environment/org/run/attempt, purpose and version. The encrypted
in-memory implementation is test-only and zeroizes callback buffers. It is not
an OS memory-isolation guarantee or a managed KMS implementation.

Use versioned references for GitHub App keys, webhook HMAC secrets, artifact
signing keys and provider credentials. Generate/install the replacement with the
upstream provider, validate using a dedicated staging asset, rotate the managed
reference, allow only the explicitly bounded overlap (maximum 15 minutes), then
revoke the upstream old credential and invalidate cached tokens/URLs. A local
reference rotation alone does not revoke a GitHub/provider-issued token.

The runner broker refuses signing keys, App keys, global provider credentials and
webhook secrets. Only per-attempt target sessions, preview bypass and synthetic
test-provider secrets are deliverable. Authorization is rechecked before
delivery; audience and scope are verified; leases are revoked in finally, even
on failed injection. Providers must enforce injected credential expiry/revocation.

Live managed-backend rotation, upstream revocation and artifact URL invalidation
remain UNVERIFIED. Emergency procedure: stop new dispatch, revoke grants and
provider authority, expire exact affected resources, confirm destruction, rotate
credentials, then requalify capabilities. Never log secret material for diagnosis.
