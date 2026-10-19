export function gatePresentation(decision: unknown, validUntil: unknown, now = Date.now()) {
 if(decision==="SHIP")return typeof validUntil==="string"&&Date.parse(validUntil)>now?"SHIP":"STALE";
 return decision==="BLOCK"?"BLOCK":"INCONCLUSIVE";
}
export function waiverPresentation(revokedAt:unknown,expiresAt:unknown,now=Date.now()) {
 return revokedAt?"REVOKED":typeof expiresAt==="string"&&Date.parse(expiresAt)>now?"ACTIVE_WAIVER":"EXPIRED";
}
