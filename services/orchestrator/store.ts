export interface ExecutionStore {command(action:string,data:Record<string,unknown>):Promise<unknown>}
// Pure service boundary. The host supplies credentials; the runner never gets
// this adapter, a database client or a general-purpose service command capability.
export function rpcExecutionStore(rpc:(name:string,args:Record<string,unknown>)=>Promise<{data:unknown;error:unknown}>):ExecutionStore {
 return {async command(action,data){const result=await rpc("lg_execution_service",{p_action:action,p_data:data});if(result.error)throw new Error("EXECUTION_DENIED");return result.data;}};
}
