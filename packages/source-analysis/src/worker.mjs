import { parentPort, workerData } from "node:worker_threads";
import { analyze } from "./engine.mjs";
try { parentPort.postMessage({ok:true,result:analyze(workerData)}); }
catch { parentPort.postMessage({ok:false,code:"STATIC_ANALYSIS_FAILED"}); }
