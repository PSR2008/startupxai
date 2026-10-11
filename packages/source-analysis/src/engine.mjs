import ts from "typescript";
import { hash } from "./ingestion.mjs";

export const analysisVersion = "lg-static-1";
const ecosystem = { next:"Next.js", react:"React", "@supabase/supabase-js":"Supabase", "@supabase/ssr":"Supabase", pg:"PostgreSQL", postgres:"PostgreSQL", stripe:"Stripe", razorpay:"Razorpay", vercel:"Vercel", openai:"OpenAI", "@anthropic-ai/sdk":"Anthropic" };
const families = [
  {domain:"tenant_isolation",kinds:["TENANT_CHECK","TENANT_COLUMN"],statement:"A member of one organization must not access another organization's resources."},
  {domain:"authorization",kinds:["ROLE_CHECK"],statement:"A member must not grant itself owner or administrator privileges."},
  {domain:"billing",kinds:["PAYMENT_ENDPOINT","ENTITLEMENT_CHECK"],statement:"A failed or unverified payment must not grant paid entitlement."},
  {domain:"webhooks",kinds:["WEBHOOK_ENDPOINT"],statement:"Reprocessing a payment event must not create a second entitlement effect."},
  {domain:"paid_features",kinds:["ENTITLEMENT_CHECK"],statement:"A free account must not invoke an operation designated as paid-only."},
  {domain:"ai_cost",kinds:["AI_PROVIDER_CALL","QUOTA_CHECK"],statement:"AI usage must remain within server-controlled plan and cost limits."},
  {domain:"authentication",kinds:["AUTH_BOUNDARY","ROUTE_HANDLER"],statement:"Anonymous callers must not access actions designated as authenticated."},
];
/** Syntax-only. No compiler host, module resolution, require/eval, emit, or config loading. */
export function analyze(input) {
  const nodes=[], edges=[], diagnostics=[], signals=[];
  const add=(file,kind,start,end=start,detail="OBSERVED")=>{
    const provenance={path:file.path,digest:file.digest,blobSha:file.blobSha,startLine:start,endLine:end};
    const id=hash(JSON.stringify([file.path,kind,start,end,detail])).slice(0,32);
    if(!nodes.some(n=>n.id===id)) nodes.push({id,kind,detail,provenance});
    return id;
  };
  const signal=(stack,file,line,reason,endLine=line)=>signals.push({stack,reason,provenance:{path:file.path,digest:file.digest,blobSha:file.blobSha,startLine:line,endLine}});
  for(const file of input.files) {
    if(typeof file.text!=="string") continue;
    if(file.classification==="MANIFEST") {
      try {
        const manifest=JSON.parse(file.text);
        for(const group of ["dependencies","devDependencies","peerDependencies"]) for(const name of Object.keys(manifest?.[group] || {})) if(Object.hasOwn(ecosystem,name)) signal(ecosystem[name],file,1,"MANIFEST_DECLARATION",file.text.split("\n").length);
        if(manifest?.scripts) diagnostics.push({path:file.path,code:"SCRIPTS_NOT_EXECUTED"});
      } catch {diagnostics.push({path:file.path,code:"MALFORMED_MANIFEST"});}
      continue;
    }
    if(file.path.endsWith("vercel.json")) {try {JSON.parse(file.text);signal("Vercel",file,1,"DEPLOYMENT_CONFIGURATION");}catch{diagnostics.push({path:file.path,code:"MALFORMED_CONFIG"});}}
    if(file.classification==="MIGRATION") {
      // SQL is a conservative lexical observation, not policy validation or execution.
      const lines=file.text.replace(/\/\*[\s\S]*?\*\//g,m=>"\n".repeat((m.match(/\n/g)||[]).length)).split("\n");
      add(file,"MIGRATION",1,lines.length,"LEXICAL_SQL_ONLY");
      const patterns=[["DATABASE_TABLE",/\bcreate\s+table\b/i],["RLS_ENABLEMENT",/\benable\s+row\s+level\s+security\b/i],["RLS_POLICY",/\bcreate\s+policy\b/i],["SECURITY_DEFINER",/\bsecurity\s+definer\b/i],["GRANT",/\bgrant\s+/i],["REVOKE",/\brevoke\s+/i],["TENANT_COLUMN",/\b(organization_id|tenant_id|owner_id|user_id)\b/i]];
      lines.forEach((line,i)=>{const code=line.replace(/--.*$/,"");for(const [kind,pattern]of patterns)if(pattern.test(code))add(file,kind,i+1,i+1,"AMBIGUOUS_SQL_OBSERVATION");});
      signal("PostgreSQL",file,1,"SQL_DIALECT_CANDIDATE"); continue;
    }
    if(!/\.(tsx?|jsx?|mjs|cjs)$/.test(file.path)) continue;
    const source=ts.createSourceFile(file.path,file.text,ts.ScriptTarget.Latest,true,file.path.endsWith("x")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
    if(source.parseDiagnostics?.length) {diagnostics.push({path:file.path,code:"MALFORMED_SOURCE"});continue;}
    const line=node=>source.getLineAndCharacterOfPosition(node.getStart(source)).line+1;
    const end=node=>source.getLineAndCharacterOfPosition(node.getEnd()).line+1;
    const imports=new Map(); let client=false;
    for(const stmt of source.statements) {
      if(ts.isExpressionStatement(stmt)&&ts.isStringLiteral(stmt.expression)&&stmt.expression.text==="use client") client=true;
      if(ts.isImportDeclaration(stmt)&&ts.isStringLiteral(stmt.moduleSpecifier)) {
        const moduleName=stmt.moduleSpecifier.text;
        const stackName=Object.hasOwn(ecosystem,moduleName)?ecosystem[moduleName]:undefined;
        if(stackName) signal(stackName,file,line(stmt),"SYNTAX_IMPORT");
        if(stmt.importClause?.name) imports.set(stmt.importClause.name.text,moduleName);
        const bindings=stmt.importClause?.namedBindings;
        if(bindings&&ts.isNamedImports(bindings))for(const el of bindings.elements)imports.set(el.name.text,moduleName);
        add(file,"EXTERNAL_INTEGRATION",line(stmt),end(stmt),stackName||"UNRESOLVED_IMPORT");
      }
    }
    const scope=client?"CLIENT_OBSERVATION":"SERVER_CANDIDATE";
    if(/(^|\/)(app|src\/app)\/.*\/(route|page)\.[jt]sx?$/.test(file.path)||/(^|\/)app\/(route|page)\.[jt]sx?$/.test(file.path)) {
      add(file,file.path.includes("route.")?"ROUTE_HANDLER":"PAGE",1,1,scope); signal("Next.js",file,1,"ROUTE_LAYOUT");
    }
    if(/(^|\/)middleware\.[jt]s$/.test(file.path))add(file,"MIDDLEWARE",1,1,scope);
    const stack=[source]; let visited=0;
    while(stack.length) {
      const node=stack.pop(); if(++visited>100000) {diagnostics.push({path:file.path,code:"AST_NODE_LIMIT"});break;}
      if(ts.isCallExpression(node)||ts.isNewExpression(node)) {
        const expression=node.expression; const call=expression.getText(source); const clean=call.length<180?call:"";
        const start=line(node), finish=end(node);
        const emit=kind=>add(file,kind,start,finish,scope);
        if(/(?:createClient|createServerClient|createBrowserClient)$/.test(clean))emit("DATABASE_CLIENT");
        if(/(?:getUser|getSession|requireAuthenticatedPrincipal|requireAuth|authenticate)$/.test(clean))emit("AUTH_BOUNDARY");
        if(/(?:requireOrganizationRole|requireRole|checkRole|isAdmin|requireMembershipManagement)$/.test(clean))emit("ROLE_CHECK");
        if(/(?:requireOrganizationMembership|requireProjectAccess|checkTenant)$/.test(clean))emit("TENANT_CHECK");
        if(/(?:checkPlan|requirePlan|checkEntitlement|requirePaid|activatePlan|grantEntitlement)$/.test(clean))emit("ENTITLEMENT_CHECK");
        if(/(?:checkQuota|reserveUsage|checkUsageLimit|rateLimit|incrementUsage|consumeQuota)$/.test(clean))emit("QUOTA_CHECK");
        if(/(?:orders\.create|checkout\.sessions\.create|paymentIntents\.create|payments\.fetch|refunds\.create|subscriptions\.cancel)$/.test(clean))emit("PAYMENT_ENDPOINT");
        if(/(?:constructEvent|verifyWebhook|validateWebhookSignature)$/.test(clean))emit("WEBHOOK_ENDPOINT");
        if(/(?:messages\.create|chat\.completions\.create|responses\.create)$/.test(clean))emit("AI_PROVIDER_CALL");
        if(/\.from$/.test(clean)&&node.arguments?.[0]&&ts.isStringLiteral(node.arguments[0]))emit("DATABASE_TABLE");
        if(/\.(eq|match)$/.test(clean)&&node.arguments?.[0]&&ts.isStringLiteral(node.arguments[0])&&/^(organization_id|tenant_id|user_id|owner_id)$/.test(node.arguments[0].text))emit("TENANT_CHECK");
      }
      if(ts.isPropertyAccessExpression(node)&&ts.isIdentifier(node.name)&&/^(SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY)$/.test(node.name.text))add(file,node.name.text.includes("SERVICE_ROLE")?"SERVICE_ROLE_USE":"CREDENTIAL_ENV_USE",line(node),end(node),scope);
      if(ts.isIdentifier(node)&&/^(role|roles|isAdmin|organizationId|tenantId|plan|entitlement|quota|usageLimit)$/.test(node.text))add(file,/role|Admin/.test(node.text)?"ROLE_CHECK":/organization|tenant/.test(node.text)?"TENANT_CHECK":/plan|entitlement/.test(node.text)?"ENTITLEMENT_CHECK":"QUOTA_CHECK",line(node),end(node),"AMBIGUOUS_IDENTIFIER");
      ts.forEachChild(node,child=>{stack.push(child);});
    }
    if(/webhook/i.test(file.path))add(file,"WEBHOOK_ENDPOINT",1,1,"AMBIGUOUS_FILENAME");
  }
  // Edges describe observed co-location only, never a fabricated call graph.
  for(const file of input.files) {
    const local=nodes.filter(n=>n.provenance.path===file.path); const route=local.find(n=>["ROUTE_HANDLER","PAGE","MIGRATION"].includes(n.kind));
    if(route) for(const node of local)if(node.id!==route.id)edges.push({from:route.id,to:node.id,kind:"CONTAINS_OBSERVATION",provenance:node.provenance});
  }
  const stacks=[...new Set(Object.values(ecosystem))].map(name=>{
    const evidence=signals.filter(s=>s.stack===name); const strong=evidence.some(s=>["SYNTAX_IMPORT","MANIFEST_DECLARATION","DEPLOYMENT_CONFIGURATION"].includes(s.reason));
    return {name,status:strong?"DETECTED":evidence.length||input.status!=="COMPLETE"||diagnostics.some(d=>d.code.startsWith("MALFORMED"))?"AMBIGUOUS":"NOT_DETECTED",evidence};
  });
  const proposals=families.flatMap(family=>{
    const evidence=nodes.filter(n=>family.kinds.includes(n.kind)).slice(0,20);if(!evidence.length)return [];
    return [{id:hash(JSON.stringify([family.domain,evidence.map(n=>n.id)])).slice(0,32),domain:family.domain,statement:family.statement,
      rationale:"Deterministic source observations suggest this business boundary may exist.",evidence:evidence.map(n=>n.provenance),
      assumptions:["Business policy and intended actors require human confirmation.","Static source observations do not establish runtime enforcement.","Aliases, generated code and unsupported syntax may be missed."],
      confidence:evidence.some(n=>!n.detail.startsWith("AMBIGUOUS"))?"MEDIUM":"LOW",confirmationRequired:true,status:"PROPOSED"}];
  });
  return {analysisVersion,kind:"STATIC_OBSERVATIONS",coverage:{status:diagnostics.some(d=>d.code.startsWith("MALFORMED")||d.code==="AST_NODE_LIMIT")?"PARTIAL":input.status,exclusions:input.coverage,diagnostics},stacks,nodes,edges,proposals};
}
