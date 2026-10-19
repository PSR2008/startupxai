"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { Brand, Field, Form, Alert } from "./ui";
type Mode="login"|"signup"|"forgot-password"|"reset-password";
const titles:Record<Mode,string>={login:"Welcome to LaunchGate",signup:"Create your workspace account","forgot-password":"Reset your password","reset-password":"Choose a new password"};
const buttons:Record<Mode,string>={login:"Sign in",signup:"Create account","forgot-password":"Send reset link","reset-password":"Update password"};
export function Auth({mode="login"}:{mode?:Mode}){
 const router=useRouter(),[error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 return <div className="lg-login"><div className="lg-login-story"><Brand/><div><p className="lg-eyebrow">FROM ASSUMPTION TO EVIDENCE</p><h1>Ship with<br/>a reason.</h1><p>Know what was verified, what failed, and what still needs proof.</p><div className="lg-login-proof"><span>01 / Define what must hold</span><span>02 / Reproduce what breaks</span><span>03 / Verify before release</span></div></div><small>Release assurance. Grounded in evidence.</small></div><main className="lg-login-form"><p className="lg-eyebrow">YOUR WORKSPACE</p><h2>{titles[mode]}</h2><p className="lg-muted">{mode==="login"?"Sign in to continue to your projects.":mode==="signup"?"Use your work email. Verification may be required.":"Use the secure link sent to your account email."}</p>{error&&<Alert error>{error}</Alert>}{message&&<Alert>{message}</Alert>}<Form label={buttons[mode]} busy={busy} onSubmit={async values=>{
 setBusy(true);setError("");setMessage("");
 try{
  const auth=getSupabaseBrowserClient().auth,email=String(values.get("email")??""),password=String(values.get("password")??"");
  const callback=`${window.location.origin}/app/auth/callback`;
  if(mode==="login"){const result=await auth.signInWithPassword({email,password});if(result.error){setError("Sign-in failed. Check your email and password, or reset your password.");return;}router.replace("/app");}
  else if(mode==="signup"){const result=await auth.signUp({email,password,options:{emailRedirectTo:callback}});if(result.error){setError("Account creation could not be completed. Check your details or sign in if you already have an account.");return;}if(result.data.session)router.replace("/app/onboarding");else setMessage("Check your email for the confirmation link, then return to your workspace.");}
  else if(mode==="forgot-password"){const result=await auth.resetPasswordForEmail(email,{redirectTo:`${callback}?next=reset-password`});if(result.error){setError("The reset request could not be completed. Please try again later.");return;}setMessage("If this email has an account, a reset link has been sent.");}
  else{const {data}=await auth.getSession();if(!data.session){setError("The reset session has expired. Request a new reset link.");return;}const result=await auth.updateUser({password});if(result.error){setError("The password could not be updated. Request a new reset link and try again.");return;}await auth.signOut();router.replace("/app/login");}
 }catch{setError("Authentication is unavailable in this environment. Retry after configuration is restored.");}finally{setBusy(false);}
 }}>
 {mode!=="reset-password"&&<Field label="Email"><input name="email" type="email" required autoComplete="email" placeholder="you@company.com"/></Field>}
 {mode!=="forgot-password"&&<Field label="Password" hint={mode==="login"?undefined:"Use at least 12 characters."}><input name="password" type="password" required minLength={mode==="login"?1:12} autoComplete={mode==="login"?"current-password":"new-password"}/></Field>}
 </Form><div className="lg-auth-links"><Link href={mode==="login"?"/app/forgot-password":"/app/login"}>{mode==="login"?"Forgot password?":"Back to sign in"}</Link>{mode==="login"&&<Link href="/app/signup">Create an account</Link>}</div><Link className="lg-muted" href="/">← Back to LaunchGate</Link></main></div>;
}
