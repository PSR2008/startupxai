import { Worker } from "node:worker_threads";
import { limits } from "./ingestion.mjs";

/** Trusted Node worker host, not a runner for customer code. Empty environment;
 * receives source data only. Parent enforces wall time even if parsing stalls.
 * @param {object} source
 * @param {number} timeoutMs
 */
export function runAnalysis(source, timeoutMs=limits.parseMs) {
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>limits.parseMs)throw new Error("INVALID_LIMIT");
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL("./worker.mjs",import.meta.url),{workerData:source,env:{},execArgv:[],resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:16,stackSizeMb:4}});
    let settled=false;
    const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);void worker.terminate();if(error)reject(new Error("STATIC_ANALYSIS_FAILED"));else resolve(result);};
    const timer=setTimeout(()=>finish(true),timeoutMs);
    worker.once("message",message=>finish(!message?.ok,message?.result));worker.once("error",()=>finish(true));worker.once("exit",()=>finish(true));
  });
}
