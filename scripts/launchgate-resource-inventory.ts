import { execFileSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { z } from "zod";
const schema=z.object({containers:z.array(z.string()),temporary:z.array(z.string())}).strict();
const baseline="phase10-resource-baseline.log";
async function inventory(){
 const containers=execFileSync("docker",["ps","-aq","--filter","label=launchgate.disposable=true"],{encoding:"utf8",windowsHide:true,timeout:15000}).trim().split(/\s+/).filter(Boolean);
 const temporary=(await readdir(tmpdir())).filter(name=>name.startsWith("launchgate-")).sort();
 return {containers,temporary};
}
async function main(){
 const current=await inventory();
 if(process.argv[2]==="capture"){await writeFile(baseline,JSON.stringify(current),{flag:"wx"});process.stdout.write("Scoped resource baseline captured.\n");return;}
 if(process.argv[2]!=="check")throw new Error("Use capture or check");
 const old=schema.parse(JSON.parse(await readFile(baseline,"utf8")));
 const leaked={containers:current.containers.filter(x=>!old.containers.includes(x)),temporary:current.temporary.filter(x=>!old.temporary.includes(x))};
 if(leaked.containers.length||leaked.temporary.length){process.stderr.write(`${JSON.stringify(leaked)}\n`);process.exitCode=1;return;}
 process.stdout.write("No new LaunchGate disposable containers or temporary resources.\n");
}
void main().catch(()=>{process.stderr.write("Resource inventory unavailable; cannot certify cleanup.\n");process.exitCode=1;});
