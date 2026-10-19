"use client";
import { useEffect,useRef,useState } from "react";
import Link from "next/link";
import { api,errorCopy } from "./client";
import { Alert,Loading,Panel } from "./ui";
export function GitHubCallback(){
 const started=useRef(false),[error,setError]=useState(""),[project,setProject]=useState("");
 useEffect(()=>{if(started.current)return;started.current=true;const query=new URLSearchParams(location.search),state=query.get("state"),code=query.get("code");history.replaceState(null,"","/app/github/callback");
  try{const saved=JSON.parse(sessionStorage.getItem("launchgate-github-setup")??"null");sessionStorage.removeItem("launchgate-github-setup");if(!saved||saved.state!==state||!code||!state||!Number.isFinite(saved.expires)||Date.now()>saved.expires||!/^[-a-f0-9]{36}$/.test(saved.projectId))throw new Error("SETUP_EXPIRED");void api(`projects/${saved.projectId}/github/connections`,{state,code}).then(()=>setProject(saved.projectId)).catch(e=>setError(errorCopy(e)));}catch{setError("GitHub setup expired or does not match this browser session. Return to your project and start authorization again.");}
 },[]);
 return <Panel title="GitHub authorization">{error?<Alert error>{error}</Alert>:project?<div className="lg-panel-body"><p>Repository connection verified.</p><Link className="lg-button" href={`/app/projects/${project}/repository`}>Continue source setup →</Link></div>:<Loading/>}</Panel>;
}
