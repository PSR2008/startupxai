import { githubConfiguration } from "@/server/github/config";
import { sourceStore } from "@/server/github/store";
import { receiveWebhook } from "@/server/github/webhook";
import { serializeApiError } from "@/server/http/api-error";

export const runtime="nodejs";
export async function POST(request:Request) {
 try{return await receiveWebhook(request,githubConfiguration(),sourceStore());}
 catch(error){const safe=serializeApiError(error);return Response.json(safe.body,{status:safe.status});}
}
