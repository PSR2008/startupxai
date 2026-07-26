import { AlertTriangle, Database, ExternalLink, Info, ShieldCheck } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { classifyEvidenceItem } from "@/lib/evidence-display";
import type { CategoryScore, EvidenceConfidence, EvidenceItem, ProviderRunStatus, ScoreComponent } from "@/lib/evidence-types";

export function ConfidenceBadge({ confidence }: { confidence: EvidenceConfidence }) {
  const variant = confidence === "high" ? "emerald" : confidence === "medium" ? "amber" : "rose";
  return <Badge variant={variant} size="sm" dot>{confidence} confidence</Badge>;
}

export function SourceBadge({ item }: { item: EvidenceItem }) {
  const variant = item.verifiedStatus === "verified" ? "emerald" : item.verifiedStatus === "user_provided" ? "blue" : "neutral";
  return <Badge variant={variant} size="sm">{classifyEvidenceItem(item)}</Badge>;
}

export function ProviderStatus({ run }: { run: ProviderRunStatus }) {
  const variant = run.status === "success" || run.status === "configured" ? "emerald" : run.status === "not_configured" ? "amber" : run.status === "failed" ? "rose" : "neutral";
  return (
    <div className="surface-inset min-w-0 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 break-words font-bricolage text-xs font-bold text-gray-900">{run.providerName}</p>
        <Badge variant={variant} size="sm" className="flex-shrink-0">{run.status.replace("_", " ")}</Badge>
      </div>
      <p className="mt-2 break-words font-jakarta text-xs leading-relaxed text-gray-500">{run.message}</p>
    </div>
  );
}

export function EvidenceCard({ item }: { item: EvidenceItem }) {
  const sourceMetadata = item.rawMetadata ?? {};
  const isPublicUrl = item.sourceType === "public_url";
  const hostname = typeof sourceMetadata.hostname === "string" ? sourceMetadata.hostname : null;
  const retrievedAt = typeof sourceMetadata.retrievedAt === "string" ? sourceMetadata.retrievedAt : null;
  const publicationDate = typeof sourceMetadata.publicationDate === "string" ? sourceMetadata.publicationDate : null;
  const sourceExplanation = typeof sourceMetadata.explanation === "string" ? sourceMetadata.explanation : null;
  return (
    <article className="surface-panel min-w-0 max-w-full p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="break-words font-bricolage text-sm font-bold text-gray-900">{item.title}</p>
          <p className="mt-1 break-words font-jakarta text-xs text-gray-400">{item.sourceName} - {classifyEvidenceItem(item)}</p>
        </div>
        <SourceBadge item={item} />
      </div>
      <p className="break-words font-jakarta text-sm leading-relaxed text-gray-600">{item.summary}</p>
      {item.excerpt && (
        <p className="surface-inset mt-3 break-words p-3 font-jakarta text-xs leading-relaxed text-gray-500">{item.excerpt}</p>
      )}
      {isPublicUrl && (
        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3">
          <p className="font-bricolage text-xs font-bold text-blue-900">Public source attribution</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="blue" size="sm">Public URL</Badge>
            {hostname && <Badge variant="neutral" size="sm">{hostname}</Badge>}
            {retrievedAt && <Badge variant="neutral" size="sm">Retrieved {new Date(retrievedAt).toLocaleDateString()}</Badge>}
            {publicationDate && <Badge variant="neutral" size="sm">Published {new Date(publicationDate).toLocaleDateString()}</Badge>}
            <Badge variant="amber" size="sm">Relevance not independently verified</Badge>
          </div>
          {sourceExplanation && (
            <p className="mt-2 break-words font-jakarta text-xs leading-relaxed text-blue-900">{sourceExplanation}</p>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant={item.direction === "contradicts" ? "rose" : item.direction === "supports" ? "emerald" : "neutral"} size="sm">{item.direction}</Badge>
        <Badge variant="neutral" size="sm">relevance {item.relevanceScore}/100</Badge>
        <Badge variant="neutral" size="sm">reliability {item.reliabilityScore}/100</Badge>
        {item.sourceUrl && (
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 break-all font-bricolage text-[11px] font-bold text-emerald-700 hover:text-emerald-800" aria-label="Open source in a new tab">
            Open source <ExternalLink size={11} aria-hidden="true" />
          </a>
        )}
      </div>
    </article>
  );
}

function componentTone(kind: ScoreComponent["evidenceKind"]) {
  if (kind === "verified") return "bg-emerald-500";
  if (kind === "user_provided") return "bg-blue-500";
  if (kind === "inferred") return "bg-amber-500";
  if (kind === "ai_interpretation") return "bg-violet-500";
  return "bg-gray-300";
}

export function ScoreBreakdown({ score }: { score: CategoryScore }) {
  return (
    <div className="space-y-3">
      {score.components.map((component) => (
        <div key={component.componentName} className="surface-inset min-w-0 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words font-bricolage text-xs font-bold text-gray-800">{component.componentName}</p>
              <p className="mt-1 break-words font-jakarta text-[11px] text-gray-400">{component.evidenceKind.replace("_", " ")} signal - weight {component.weight}</p>
            </div>
            <p className="flex-shrink-0 font-bricolage text-sm font-bold text-gray-900">{component.normalizedValue}/100</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
            <div className={`h-full rounded-full ${componentTone(component.evidenceKind)}`} style={{ width: `${component.normalizedValue}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MethodologyDrawer({ score }: { score: CategoryScore }) {
  return (
    <details className="surface-inset group min-w-0 p-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-bricolage text-xs font-bold text-gray-700">
        <Info size={13} className="text-emerald-600" />
        How this score was calculated
      </summary>
      <div className="mt-3">
        <p className="mb-3 break-words font-jakarta text-xs leading-relaxed text-gray-500">{score.methodology}</p>
        <ScoreBreakdown score={score} />
      </div>
    </details>
  );
}

export function ValidationDecisionPanel({ overallScore, confidence }: { overallScore: number; confidence: EvidenceConfidence }) {
  const recommendation =
    overallScore >= 70 ? "Proceed with a limited evidence test" :
    overallScore >= 50 ? "Assess further before building" :
    "Pause build work and test the riskiest assumptions";
  return (
    <section className="w-full max-w-full rounded-xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex items-start gap-3">
        {overallScore >= 50 ? <ShieldCheck size={18} className="mt-1 text-emerald-700" /> : <AlertTriangle size={18} className="mt-1 text-amber-700" />}
        <div className="min-w-0">
          <p className="font-jakarta text-xs font-semibold text-emerald-800">Evidence assessment</p>
          <h3 className="mt-1 break-words font-bricolage text-xl font-bold text-gray-950">{recommendation}</h3>
          <p className="mt-2 break-words font-jakarta text-sm leading-relaxed text-gray-600">
            Current evidence supports this recommendation with {confidence} confidence. Treat it as an assessment, not a prediction of business outcomes.
          </p>
        </div>
      </div>
    </section>
  );
}

export function DataFreshnessBadge({ label = "Calculated now" }: { label?: string }) {
  return <Badge variant="blue" size="sm"><Database size={11} /> {label}</Badge>;
}
