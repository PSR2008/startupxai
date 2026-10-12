import type { RunnerControl } from "./runner";
export function runnerControl(endpoint:string):RunnerControl {
 const u=new URL(endpoint);if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||u.pathname!=="/")throw new Error("CONTROL_ENDPOINT");
 return {async call(action,token,payload){
  const response=await fetch(new URL(`/internal/runner/${action}`,u),{method:"POST",redirect:"error",signal:AbortSignal.timeout(2000),headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify(payload)});
  await response.body?.cancel();if(!response.ok)throw new Error("EXECUTION_STOPPED");
 }};
}
