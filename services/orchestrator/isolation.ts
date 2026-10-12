import { z } from "zod";
// Backend-neutral launch specification. This is not a sandbox implementation.
// Only trusted fixed runner images; no repository path, command, shell or code.
export function isolatedRunnerSpec(input:{attemptId:string;grant:string;deadline:string},config:{imageDigest:string;controlOrigin:string;publicKey:string}) {
 z.string().uuid().parse(input.attemptId);z.string().regex(/^sha256:[a-f0-9]{64}$/).parse(config.imageDigest);
 const origin=new URL(config.controlOrigin);if(origin.protocol!=="https:"||origin.username||origin.password||origin.pathname!=="/"||origin.search||origin.hash)throw new Error("CONTROL_ORIGIN");
 return Object.freeze({executionId:input.attemptId,imageDigest:config.imageDigest,deadline:input.deadline,
  environment:Object.freeze({LAUNCHGATE_CONTROL_ORIGIN:origin.origin,LAUNCHGATE_RUNNER_PUBLIC_KEY:config.publicKey}),
  stdin:input.grant,readOnlyRoot:true,networkPolicy:"SCOPED_EGRESS_REQUIRED" as const,customerCode:false as const});
}
