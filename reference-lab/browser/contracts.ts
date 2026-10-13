import { z } from "zod";
export const browserCases=["browser.signup","browser.login","browser.protected","browser.paid","browser.logout","browser.crud","browser.invalid","browser.expired","browser.server_error","browser.missing","browser.entitlement","browser.quota","browser.release"] as const;
export type BrowserCase=typeof browserCases[number];export const isBrowser=(id:string):id is BrowserCase=>(browserCases as readonly string[]).includes(id);
const paths=z.enum(["/login","/signup","/dashboard","/paid","/logout","/edit","/expire","/server-error","/quota"]);
const targets=z.enum(["username","password","submit","value","save","dashboard","paid","denied","error","success","record"]);
export const stepSchema=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("NAVIGATE"),path:paths}).strict(),
 z.object({kind:z.enum(["CLICK","SUBMIT","WAIT_FOR"]),target:targets}).strict(),
 z.object({kind:z.literal("FILL"),target:targets,value:z.enum(["paid","free","synthetic-password","invalid","created","updated",""])}).strict(),
 z.object({kind:z.literal("ASSERT_VISIBLE"),target:targets,expected:z.boolean()}).strict(),
 z.object({kind:z.literal("ASSERT_URL"),path:paths}).strict(),
 z.object({kind:z.literal("ASSERT_TEXT"),target:targets,value:z.enum(["created","updated"])}).strict(),
 z.object({kind:z.literal("ASSERT_AUTH_STATE"),expected:z.boolean()}).strict(),
]);
export type Step=z.infer<typeof stepSchema>;
export const journeySchema=z.object({version:z.literal(1),identity:z.literal("synthetic_user"),startPath:paths,steps:z.array(stepSchema).min(1).max(40),timeoutMs:z.literal(45000),evidence:z.literal("SELECTED_MARKERS_ONLY")}).strict();
const nav=(path:z.infer<typeof paths>):Step=>({kind:"NAVIGATE",path});
const visible=(target:z.infer<typeof targets>,expected=true):Step=>({kind:"ASSERT_VISIBLE",target,expected});
export const login=(user:"paid"|"free"="paid",password:"synthetic-password"|"invalid"="synthetic-password",signup=false):Step[]=>[nav(signup?"/signup":"/login"),{kind:"FILL",target:"username",value:user},{kind:"FILL",target:"password",value:password},{kind:"SUBMIT",target:"submit"}];
export function journey(id:string){let steps:Step[];
 switch(id){
  case "browser.signup":steps=[...login("paid","synthetic-password",true),visible("dashboard"),{kind:"ASSERT_AUTH_STATE",expected:true}];break;
  case "browser.login":steps=[...login(),{kind:"ASSERT_URL",path:"/dashboard"},visible("dashboard")];break;
  case "browser.protected":steps=[nav("/dashboard"),visible("denied"),{kind:"ASSERT_AUTH_STATE",expected:false}];break;
  case "browser.paid":case "browser.entitlement":steps=[...login("free"),nav("/paid"),visible("denied"),visible("paid",false)];break;
  case "browser.logout":steps=[...login(),nav("/logout"),nav("/dashboard"),visible("denied"),{kind:"ASSERT_AUTH_STATE",expected:false}];break;
  case "browser.invalid":steps=[...login("paid","invalid"),visible("error"),visible("dashboard",false),{kind:"ASSERT_AUTH_STATE",expected:false}];break;
  case "browser.expired":steps=[...login(),nav("/expire"),nav("/dashboard"),visible("denied"),{kind:"ASSERT_AUTH_STATE",expected:false}];break;
  case "browser.server_error":steps=[...login(),nav("/server-error"),visible("error"),visible("success",false)];break;
  case "browser.quota":steps=[...login(),nav("/quota"),visible("denied"),visible("success",false)];break;
  case "browser.missing":steps=[...login(),nav("/edit"),{kind:"SUBMIT",target:"save"},visible("error"),visible("success",false)];break;
  case "browser.crud":steps=[...login(),nav("/edit"),{kind:"FILL",target:"value",value:"created"},{kind:"SUBMIT",target:"save"},{kind:"ASSERT_TEXT",target:"record",value:"created"},nav("/edit"),{kind:"FILL",target:"value",value:"updated"},{kind:"SUBMIT",target:"save"},{kind:"ASSERT_TEXT",target:"record",value:"updated"}];break;
  default:steps=[...login(),{kind:"ASSERT_URL",path:"/dashboard"},visible("dashboard"),nav("/paid"),visible("paid"),nav("/logout"),nav("/dashboard"),visible("denied"),{kind:"ASSERT_AUTH_STATE",expected:false}];
 }
 return journeySchema.parse({version:1,identity:"synthetic_user",startPath:steps[0].kind==="NAVIGATE"?steps[0].path:"/login",steps,timeoutMs:45000,evidence:"SELECTED_MARKERS_ONLY"});
}
export const browserAssertions=[{id:"journey",observation:"journey_assertions_match",comparator:"equals" as const,expected:true},{id:"business",observation:"journey_business_state_matches",comparator:"equals" as const,expected:true}];
export const browserStateSchema=z.object({authenticated:z.boolean(),paidAccess:z.boolean(),record:z.enum(["","created","updated"]),successes:z.number().int().nonnegative(),providerCalls:z.number().int().nonnegative()}).strict();
export const browserTraceSchema=z.object({control:z.array(z.boolean()).max(20),checks:z.array(z.boolean()).max(40),state:browserStateSchema.nullable(),urls:z.array(z.string().max(80)).max(50),statuses:z.array(z.number().int()).max(100),console:z.array(z.enum(["ERROR","WARNING"])).max(10),blocked:z.number().int().nonnegative(),actions:z.number().int().max(100),runtimeMs:z.number().int().max(180000),artifactBytes:z.number().int().max(65536),realFinancialSpend:z.literal(0),reason:z.enum(["NONE","BROKEN_CONTROL","BROWSER_FAILURE","SAFETY_STOP"])}).strict();
export type BrowserFault="NONE"|"BROKEN"|"CRASH"|"TIMEOUT"|"COPY"|"ESCAPE";
