import "server-only";
import { createPrivateKey } from "node:crypto";
import { z } from "zod";
import { ApiError } from "../http/api-error";

const configSchema=z.object({ appId:z.coerce.number().int().positive().safe(),clientId:z.string().regex(/^[A-Za-z0-9_.-]{5,100}$/),clientSecret:z.string().min(20).max(512),privateKey:z.string().min(64).max(16384),webhookSecret:z.string().min(32).max(512),redirectUri:z.string().url().refine(v=>new URL(v).protocol==="https:") });
export type GitHubConfig=z.infer<typeof configSchema>;
/** Not part of public health; neither credentials nor parse diagnostics leave this module. */
export function githubConfiguration(env:Record<string,string|undefined>=process.env):GitHubConfig {
  try {
    const value=configSchema.parse({appId:env.LAUNCHGATE_GITHUB_APP_ID,clientId:env.LAUNCHGATE_GITHUB_CLIENT_ID,clientSecret:env.LAUNCHGATE_GITHUB_CLIENT_SECRET,privateKey:env.LAUNCHGATE_GITHUB_PRIVATE_KEY?.replace(/\\n/g,"\n"),webhookSecret:env.LAUNCHGATE_GITHUB_WEBHOOK_SECRET,redirectUri:env.LAUNCHGATE_GITHUB_REDIRECT_URI});
    if(Object.values(value).some(v=>typeof v==="string"&&/placeholder|your[-_ ]|example\.com/i.test(v)))throw new Error();
    const key=createPrivateKey(value.privateKey);
    if(key.asymmetricKeyType!=="rsa"||(key.asymmetricKeyDetails?.modulusLength??0)<2048)throw new Error();
    return value;
  }catch{throw new ApiError("CONFIGURATION_UNAVAILABLE");}
}
