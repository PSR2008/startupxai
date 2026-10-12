import { createHash } from "node:crypto";
export const digest=(data:Uint8Array|string)=>`sha256:${createHash("sha256").update(data).digest("hex")}`;
export function canonical(value:unknown):string {
 if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;
 if(value!==null&&typeof value==="object")return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b,"en")).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
 return JSON.stringify(value);
}
