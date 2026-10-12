import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from "node:crypto";
import { executionGrantSchema, type ExecutionGrant } from "@launchgate/contracts";

export function signGrant(grant:ExecutionGrant,key:KeyObject|string):string {
 const parsed=executionGrantSchema.parse(grant);const k=typeof key==="string"?createPrivateKey(key):key;
 if(k.asymmetricKeyType!=="ed25519")throw new Error("SIGNING_KEY_TYPE");
 const body=Buffer.from(JSON.stringify(parsed)).toString("base64url");
 return `${body}.${sign(null,Buffer.from(body),k).toString("base64url")}`;
}
export function verifyGrant(token:string,key:KeyObject|string,now=Date.now()):ExecutionGrant {
 if(token.length>16384||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))throw new Error("INVALID_GRANT");
 const [body,sig]=token.split("."); const k=typeof key==="string"?createPublicKey(key):key;
 if(k.asymmetricKeyType!=="ed25519"||!verify(null,Buffer.from(body),k,Buffer.from(sig,"base64url")))throw new Error("INVALID_GRANT");
 const g=executionGrantSchema.parse(JSON.parse(Buffer.from(body,"base64url").toString("utf8")));
 if(g.iat*1000>now+5000||g.exp*1000<=now||Date.parse(g.authorization.startsAt)>now||g.authorization.revocation.state!=="ACTIVE")throw new Error("EXPIRED_GRANT");
 return g;
}
