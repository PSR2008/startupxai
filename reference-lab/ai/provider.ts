import { z } from "zod";
import { randomUUID } from "node:crypto";
import { aiCallSchema,type AiConfig } from "./contracts";
// No SDK, key, URL or network capability enters this deterministic provider.
export function syntheticCall(config:AiConfig,input:{actor:"anonymous"|"free"|"peer"|"paid"|"control";model:"small"|"premium";input:number;fail:boolean;reservationSequence:number;invocationSequence:number}){
 if(config.mode!=="SYNTHETIC")throw new Error("SAFETY_STOP");
 const factor=input.model==="premium"?2:1,output=input.fail?0:1;
 const raw=config.provider==="SYNTHETIC_OPENAI_LIKE"?{id:randomUUID(),usage:{prompt_tokens:input.input,completion_tokens:output},ok:!input.fail}:{id:randomUUID(),usage:{input_tokens:input.input,output_tokens:output},ok:!input.fail};
 const envelope=z.object({id:z.string().uuid(),usage:z.record(z.number().int().nonnegative()),ok:z.boolean()}).strict().parse(raw);
 const units=envelope.usage[config.provider==="SYNTHETIC_OPENAI_LIKE"?"prompt_tokens":"input_tokens"];
 return aiCallSchema.parse({id:envelope.id,actor:input.actor,model:input.model,input:units,output,cost:input.fail?0:(units+output)*factor,maximum:(units+2)*factor,reservationSequence:input.reservationSequence,invocationSequence:input.invocationSequence,success:envelope.ok,latency:"DETERMINISTIC_IMMEDIATE"});
}
