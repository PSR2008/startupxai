"use client";
import Link from "next/link";
import { useData, rows, object, str, type Row } from "./data";
import { Alert, Empty, Loading, Panel, Status, Timestamp, shortId } from "./ui";

export function InvariantHistory({projectId,id}:{projectId:string;id:string}) {
 const findings=useData<Row[]>(`projects/${projectId}/views/findings`,[]);
 const gates=useData<Row[]>(`projects/${projectId}/views/gates`,[]);
 const regressions=useData<Row[]>(`projects/${projectId}/views/regressions`,[]);
 const linked=findings.data.filter(x=>x.invariant_id===id);
 const evaluations=gates.data.flatMap(g=>rows(object(g.evaluation).coverage).filter(c=>c.invariantId===id).map(c=>({gate:g,item:c})));
 if([findings,gates,regressions].some(x=>x.loading))return <Loading/>;
 const error=[findings,gates,regressions].find(x=>x.error)?.error;
 if(error)return <Alert error>{error}</Alert>;
 return <><Panel title="Verification and release impact"><p className="lg-muted">Recent project records (up to 50 per category). A confirmation alone does not establish coverage.</p>{evaluations.length?evaluations.map(({gate,item})=><div className="lg-panel-body" key={str(gate,"id")}><Status value={str(item,"status")}/><p>{str(item,"reason").replaceAll("_"," ")}</p><Link href={`/app/projects/${projectId}/releases/${str(gate,"release_id")}`}>Inspect release {shortId(str(gate,"release_id"))}</Link><p>Evaluated <Timestamp value={str(gate,"created_at")}/></p></div>):<Empty title="No verification recorded in recent evaluations"/>}</Panel><Panel title="Linked findings and retained regressions">{linked.length?linked.map(f=><div className="lg-panel-body" key={str(f,"id")}><Link href={`/app/projects/${projectId}/findings/${str(f,"id")}`}>{str(f,"title",`Finding ${shortId(str(f,"id"))}`)}</Link><p><Status value={str(f,"state")}/></p>{regressions.data.filter(r=>r.finding_id===f.id).map(r=><p key={str(r,"id")}>Regression {shortId(str(r,"id"))} retained since <Timestamp value={str(r,"created_at")}/></p>)}</div>):<Empty title="No linked findings in recent records">This is not a coverage claim.</Empty>}</Panel></>;
}
