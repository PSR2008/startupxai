import { digest } from "../runner/metadata";
export { digest,canonical } from "../runner/metadata";
import { mkdir,readFile,writeFile,rm,readdir,stat } from "node:fs/promises";
import { resolve,sep } from "node:path";
export interface ArtifactStore {
 put(attemptId:string,id:string,bytes:Uint8Array,hash:string):Promise<string>;
 removeAttempt(attemptId:string):Promise<void>;
}
/** Operator-owned private directory, never served by Next/public. Production
 * adapter must provide private object storage, lifecycle retention and encryption. */
export class LocalArtifacts implements ArtifactStore {
 constructor(private readonly root:string){}
 private path(...ids:string[]){if(ids.some(x=>!/^[a-f0-9-]{36}$/.test(x)))throw new Error("ARTIFACT_ID");const root=resolve(this.root);const p=resolve(root,...ids);if(!p.startsWith(root+sep))throw new Error("ARTIFACT_PATH");return p;}
 async put(attemptId:string,id:string,bytes:Uint8Array,hash:string){
  if(bytes.length>1048576||digest(bytes)!==hash)throw new Error("ARTIFACT_HASH");
  const path=this.path(attemptId,id);await mkdir(this.path(attemptId),{recursive:true,mode:0o700});
  try{await writeFile(path,bytes,{flag:"wx",mode:0o600});}catch(error){if((error as NodeJS.ErrnoException).code!=="EEXIST"||digest(await readFile(path))!==hash)throw new Error("ARTIFACT_CONFLICT");}
  return `${attemptId}/${id}`;
 }
 async removeAttempt(attemptId:string){await rm(this.path(attemptId),{recursive:true,force:true});}
 async expire(now=Date.now()) {
  await mkdir(this.root,{recursive:true,mode:0o700});
  for(const entry of await readdir(this.root,{withFileTypes:true}))if(entry.isDirectory()&&/^[a-f0-9-]{36}$/.test(entry.name)){
   const path=this.path(entry.name);if((await stat(path)).mtimeMs<now-7*86400000)await rm(path,{recursive:true,force:true});
  }
 }
}
