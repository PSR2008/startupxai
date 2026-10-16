import { runRemediationWorker } from "../src/server/remediation/runtime";
const stop=new AbortController();
process.once("SIGINT",()=>stop.abort());process.once("SIGTERM",()=>stop.abort());
void runRemediationWorker(stop.signal).catch(()=>{process.stderr.write("LaunchGate controlled remediation worker configuration unavailable.\n");process.exitCode=1;});
