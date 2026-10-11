import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { hash } from "@launchgate/source-analysis";
import { boundedBody } from "./provider";
import { type SourceStore } from "./store";
import { ApiError,serializeApiError } from "../http/api-error";

export function verifySignature(raw:Uint8Array,signature:string|null,secret:string) {
  if(!signature||!/^sha256=[a-f0-9]{64}$/.test(signature))return false;
  return timingSafeEqual(createHmac("sha256",secret).update(raw).digest(),Buffer.from(signature.slice(7),"hex"));
}
export async function receiveWebhook(request:Request,config:{appId:number;webhookSecret:string},store:SourceStore):Promise<Response> {
  try {
    const raw=await boundedBody(new Response(request.body),262144);
    if(!verifySignature(raw,request.headers.get("x-hub-signature-256"),config.webhookSecret))throw new ApiError("ACCESS_DENIED");
    const delivery=z.string().uuid().parse(request.headers.get("x-github-delivery"));
    const eventHeader=request.headers.get("x-github-event");const event=["installation","installation_repositories","repository"].includes(eventHeader??"")?eventHeader!:"IGNORED";
    const parsed=z.object({action:z.string().max(100).optional(),installation:z.object({id:z.number().int().positive().safe()}).optional()}).parse(JSON.parse(Buffer.from(raw).toString("utf8")));
    // Signed webhooks can revoke, never grant/rebind access. Conservatively require
    // a new verified setup after removal, transfer or deletion; never trust order.
    const revoke=(event==="installation"&&["deleted","suspend"].includes(parsed.action??""))||(event==="installation_repositories"&&parsed.action==="removed")||(event==="repository"&&["deleted","transferred","privatized"].includes(parsed.action??""));
    if(event!=="IGNORED"&&!parsed.installation)throw new ApiError("INVALID_REQUEST");
    const result=await store.command("WEBHOOK",{appId:config.appId,deliveryId:delivery,installationId:parsed.installation?.id??null,event,action:revoke?"REVOKE":"IGNORE",digest:hash(raw)});
    return Response.json({ok:true,data:result},{headers:{"Cache-Control":"no-store"}});
  }catch(error){const safe=serializeApiError(error instanceof z.ZodError||error instanceof SyntaxError?new ApiError("INVALID_REQUEST"):error);return Response.json(safe.body,{status:safe.status});}
}
