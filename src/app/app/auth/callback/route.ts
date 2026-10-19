import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
/** PKCE callback dedicated to LaunchGate; the destination is a closed allowlist. */
export async function GET(request:NextRequest){
 const url=request.nextUrl,code=url.searchParams.get("code"),supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 const failure=()=>NextResponse.redirect(new URL("/app/auth-error",url.origin));
 if(!code||!supabaseUrl||!key)return failure();
 const response=NextResponse.redirect(new URL(url.searchParams.get("next")==="reset-password"?"/app/reset-password":"/app",url.origin));
 const client=createServerClient(supabaseUrl,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll:(values:Array<{name:string;value:string;options:CookieOptions}>)=>values.forEach(({name,value,options})=>response.cookies.set(name,value,options))}});
 try{const {error}=await client.auth.exchangeCodeForSession(code);return error?failure():response;}catch{return failure();}
}
