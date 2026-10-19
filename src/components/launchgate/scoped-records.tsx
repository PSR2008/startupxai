"use client";
import { useState } from "react";
import { RecordList } from "./project";
import { Empty,Field,PageHeading } from "./ui";
import { str,type Row } from "./data";
export function ScopedRecords({kind,projects}:{kind:string;projects:Row[]}){
 const [selected,setSelected]=useState("");const customerProjects=projects.filter(p=>p.purpose!=="REFERENCE_LAB"),project=customerProjects.find(p=>p.id===selected)??customerProjects[0];
 return <><PageHeading title={kind[0].toUpperCase()+kind.slice(1)}>{kind==="findings"?"Reproduced product failures, with retained evidence and resolution history.":kind==="regressions"?"Permanent checks retained after a finding is resolved.":"Release decisions tied to exact source, policy and deployment identities."}</PageHeading>{!project?<Empty title="No customer projects yet">Reference Lab results remain in the separate lab workspace.</Empty>:<><div className="lg-filter"><Field label="Project"><select value={str(project,"id")} onChange={e=>setSelected(e.target.value)}>{customerProjects.map(p=><option key={str(p,"id")} value={str(p,"id")}>{str(p,"name")}</option>)}</select></Field></div><RecordList key={str(project,"id")} projectId={str(project,"id")} kind={kind}/></>}</>;
}
