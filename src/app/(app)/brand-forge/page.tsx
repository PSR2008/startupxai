"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Layers, Palette, SwatchBook, Type, Volume2 } from "lucide-react";
import EngineHeader from "@/components/app/EngineHeader";
import { Input, Select, Textarea } from "@/components/ui/FormFields";
import Button from "@/components/ui/Button";
import CopyButton from "@/components/ui/CopyButton";
import Badge from "@/components/ui/Badge";
import ExportPdfButton from "@/components/ui/ExportPdfButton";
import { MagicBentoCard, MagicBentoGrid } from "@/components/ui/MagicBento";
import { AnalysisLoading, ErrorState } from "@/components/ui/States";
import type { BrandForgeOutput } from "@/types";
import { logUsageClient } from "@/lib/usage-client";
import { getAuthHeaders } from "@/lib/auth-headers-client";

const toneOptions = [
  { value: "premium", label: "Premium / Luxury" },
  { value: "playful", label: "Playful & Fun" },
  { value: "bold", label: "Bold & Disruptive" },
  { value: "minimal", label: "Minimal & Clean" },
  { value: "technical", label: "Technical / Expert" },
  { value: "warm", label: "Warm & Human" },
];

interface FormState {
  idea: string;
  tone: string;
  industry: string;
  targetUser: string;
  vibeKeywords: string;
}

const defaultForm: FormState = {
  idea: "",
  tone: "premium",
  industry: "",
  targetUser: "",
  vibeKeywords: "",
};

export default function BrandForgePage() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<BrandForgeOutput | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const validate = () => {
    const e: Partial<FormState> = {};
    if (!form.idea.trim()) e.idea = "Required";
    if (!form.industry.trim()) e.industry = "Required";
    if (!form.targetUser.trim()) e.targetUser = "Required";
    if (!form.vibeKeywords.trim()) e.vibeKeywords = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (status === "loading") return;
    if (!validate()) return;
    setStatus("loading");
    setSelectedName(null);

    try {
      const res = await fetch("/api/generate/brand-forge", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Brand generation failed");
      setResult(data.data);
      setStatus("success");
      logUsageClient("brand-forge");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Brand generation failed");
      setStatus("error");
    }
  };

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  };

  const brandReport = useMemo(() => {
    if (!result) return "";

    return [
      "StartupX AI - BrandForge Identity Pack",
      "",
      `Idea: ${form.idea}`,
      `Industry: ${form.industry}`,
      `Target User: ${form.targetUser}`,
      `Tone: ${form.tone}`,
      `Vibe Keywords: ${form.vibeKeywords}`,
      "",
      "Brand Name Options",
      ...result.startupNames.map((name) => `- ${name.name}: ${name.vibe}\n  Rationale: ${name.rationale}${name.domain ? `\n  Domain: ${name.domain}` : ""}`),
      "",
      "Taglines",
      ...result.taglines.map((tagline) => `- ${tagline}`),
      "",
      "Positioning Lines",
      ...result.positioningLines.map((line) => `- ${line}`),
      "",
      "Tone of Voice",
      result.toneOfVoice,
      "",
      "Brand Personality",
      ...result.brandPersonality.map((trait) => `- ${trait}`),
      "",
      "Color Direction",
      `Primary: ${result.colorDirection.primary}`,
      `Secondary: ${result.colorDirection.secondary}`,
      `Accent: ${result.colorDirection.accent}`,
      `Mood: ${result.colorDirection.mood}`,
      `Hex Suggestions: ${result.colorDirection.hexSuggestions.join(", ")}`,
      "",
      "Brand Pack Summary",
      result.brandPackSummary,
    ]
      .filter((line) => line !== "")
      .join("\n");
  }, [form, result]);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <EngineHeader
        icon={<Palette size={22} />}
        title="BrandForge"
        description="Generate names, taglines, positioning lines, voice, personality, and color direction for a brand-ready startup identity."
        badge="Creation Tool"
        badgeVariant="cocoa"
        accentColor="#7c3aed"
      />

      <MagicBentoGrid className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3" preset="app" glowColor="124, 58, 237" spotlightOpacity={0.07}>
        <ContextCard icon={<Type size={16} />} title="Name system" detail="Options with rationale" tone="amber" />
        <ContextCard icon={<Volume2 size={16} />} title="Brand voice" detail="Taglines and personality" tone="emerald" />
        <ContextCard icon={<SwatchBook size={16} />} title="Visual direction" detail="Palette mood and hex ideas" tone="violet" />
      </MagicBentoGrid>

      <div className="mt-8 space-y-8">
        <div className={status === "idle" ? "mx-auto max-w-4xl space-y-5" : "hidden"}>
          <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm shadow-gray-200/50 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-jakarta text-base font-bold text-gray-900">Brand context</h3>
                <p className="mt-1 font-jakarta text-xs text-gray-500">Define the market, audience, and emotional feel.</p>
              </div>
              <Badge variant="cocoa" size="sm">
                4 required
              </Badge>
            </div>

            <Textarea
              label="Startup Idea"
              placeholder="What does your startup do? What problem does it solve?"
              rows={3}
              value={form.idea}
              onChange={set("idea")}
              error={errors.idea}
              required
              charCount
              maxChars={500}
            />
            <Select label="Brand Tone" options={toneOptions} value={form.tone} onChange={set("tone")} required />
            <Input label="Industry" placeholder="e.g. Fintech, EdTech, Consumer SaaS" value={form.industry} onChange={set("industry")} error={errors.industry} required />
            <Textarea
              label="Target User"
              placeholder="Who is your ideal customer? Their vibe, job, lifestyle."
              rows={3}
              value={form.targetUser}
              onChange={set("targetUser")}
              error={errors.targetUser}
              required
            />
            <Input
              label="Vibe Keywords"
              placeholder="e.g. bold, minimalist, human, trustworthy, fast, elite"
              value={form.vibeKeywords}
              onChange={set("vibeKeywords")}
              error={errors.vibeKeywords}
              hint="3-6 words that capture the feel you want"
              required
            />
          </div>

          <Button size="lg" fullWidth onClick={handleSubmit} loading={status === "loading"} icon={<Palette size={15} />} iconPosition="right">
            {status === "loading" ? "Forging brand..." : "Generate Brand Identity"}
          </Button>
        </div>

        <div className={status === "idle" ? "hidden" : "w-full min-w-0 max-w-full"}>
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center shadow-sm shadow-gray-200/40"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50">
                  <Palette size={22} className="text-amber-700" />
                </div>
                <p className="mt-4 font-jakarta text-base font-bold text-gray-900">Ready to forge the brand</p>
                <p className="mt-2 max-w-sm font-jakarta text-sm leading-relaxed text-gray-500">
                  Fill in the context to generate name options, taglines, positioning, voice, personality, and color direction.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {["Names", "Voice", "Colors"].map((label) => (
                    <Badge key={label} variant="cocoa" size="sm">
                      {label}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            )}

            {status === "loading" && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AnalysisLoading engine="brand-forge" />
              </motion.div>
            )}

            {status === "error" && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="space-y-3">
                  <ErrorState message={errorMessage} onRetry={handleSubmit} />
                  <div className="flex justify-center">
                    <Button variant="outline" size="sm" onClick={() => setStatus("idle")}>Edit inputs</Button>
                  </div>
                </div>
              </motion.div>
            )}

            {status === "success" && result && (
              <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm shadow-gray-200/50">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-jakarta text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">Brand identity pack</p>
                      <h3 className="mt-1 font-jakarta text-xl font-bold text-gray-950">{result.startupNames[0]?.name || "Brand direction"}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2 no-print">
                      <Button variant="outline" size="sm" onClick={() => setStatus("idle")}>Edit inputs</Button>
                      <Button variant="outline" size="sm" onClick={() => handleSubmit()}>Run again</Button>
                      <ExportPdfButton />
                      <CopyButton text={brandReport} showLabel label="Copy pack" />
                    </div>
                  </div>
                  <p className="mt-4 font-jakarta text-sm leading-relaxed text-gray-650">{result.brandPackSummary}</p>
                </div>

                <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                  <div className="mb-4 flex items-center gap-2">
                    <Type size={14} className="text-amber-700" />
                    <h3 className="font-jakarta text-sm font-bold text-gray-900">Brand Name Options</h3>
                  </div>
                  <div className="space-y-3">
                    {result.startupNames.map((name) => (
                      <motion.div
                        key={name.name}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => setSelectedName(selectedName === name.name ? null : name.name)}
                        className={`cursor-pointer rounded-xl border p-4 transition-all ${
                          selectedName === name.name ? "border-amber-300 bg-amber-50 shadow-sm shadow-amber-100" : "border-black/6 bg-gray-50 hover:border-black/12"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-jakarta text-lg font-bold text-gray-950">{name.name}</p>
                            <p className="mt-0.5 font-jakarta text-xs italic text-gray-500">{name.vibe}</p>
                          </div>
                          <CopyButton text={name.name} size="sm" />
                        </div>
                        <AnimatePresence>
                          {selectedName === name.name && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="mt-3 space-y-2 border-t border-black/6 pt-3">
                                <p className="font-jakarta text-sm leading-relaxed text-gray-600">{name.rationale}</p>
                                {name.domain && <p className="font-jakarta text-xs text-gray-500">{name.domain}</p>}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <CopyList title="Taglines" icon={<Type size={14} />} items={result.taglines} tone="emerald" quote />
                <CopyList title="Positioning Lines" icon={<Layers size={14} />} items={result.positioningLines} tone="blue" />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                    <div className="mb-3 flex items-center gap-2">
                      <Volume2 size={13} className="text-amber-700" />
                      <h4 className="font-jakarta text-xs font-bold uppercase tracking-wide text-gray-700">Tone of Voice</h4>
                    </div>
                    <p className="font-jakarta text-sm leading-relaxed text-gray-650">{result.toneOfVoice}</p>
                  </div>

                  <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                    <div className="mb-3 flex items-center gap-2">
                      <Volume2 size={13} className="text-emerald-600" />
                      <h4 className="font-jakarta text-xs font-bold uppercase tracking-wide text-gray-700">Brand Personality</h4>
                    </div>
                    <div className="space-y-2">
                      {result.brandPersonality.map((trait, index) => (
                        <Badge key={index} variant="sage" size="md" className="h-auto w-full justify-start whitespace-normal py-1.5 text-left">
                          {trait}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {result.colorDirection && (
                  <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                    <div className="mb-4 flex items-center gap-2">
                      <Palette size={14} className="text-amber-700" />
                      <h4 className="font-jakarta text-xs font-bold uppercase tracking-wide text-gray-700">Color Direction</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {[
                        { label: "Primary", value: result.colorDirection.primary },
                        { label: "Secondary", value: result.colorDirection.secondary },
                        { label: "Accent", value: result.colorDirection.accent },
                      ].map((color) => (
                        <div key={color.label} className="rounded-xl border border-black/6 bg-gray-50 p-3">
                          <p className="mb-1 font-jakarta text-[10px] font-bold uppercase tracking-wide text-gray-400">{color.label}</p>
                          <p className="font-jakarta text-xs text-gray-650">{color.value}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 font-jakarta text-sm leading-relaxed text-gray-650">{result.colorDirection.mood}</p>
                    {result.colorDirection.hexSuggestions.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-3">
                        {result.colorDirection.hexSuggestions.map((hex) => (
                          <div key={hex} className="flex items-center gap-2 rounded-xl border border-black/6 bg-gray-50 p-2">
                            <div className="h-8 w-8 rounded-lg border border-black/10 shadow-sm" style={{ background: hex }} title={hex} />
                            <span className="font-mono text-[10px] text-gray-500">{hex}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ContextCard({ title, detail }: { icon: React.ReactNode; title: string; detail: string; tone: "amber" | "emerald" | "violet" }) {
  return (
    <MagicBentoCard className="rounded-2xl border border-black/6 bg-white p-4 shadow-sm shadow-gray-200/40">
      <div className="mb-3 h-px w-10 bg-emerald-700/35" />
      <div>
        <p className="font-jakarta text-sm font-bold text-gray-900">{title}</p>
        <p className="mt-0.5 font-jakarta text-xs leading-relaxed text-gray-500">{detail}</p>
      </div>
    </MagicBentoCard>
  );
}

function CopyList({ title, icon, items, tone, quote = false }: { title: string; icon: React.ReactNode; items: string[]; tone: "emerald" | "blue"; quote?: boolean }) {
  const toneClass = tone === "emerald" ? "text-emerald-600" : "text-blue-600";

  return (
    <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
      <div className="mb-4 flex items-center gap-2">
        <span className={toneClass}>{icon}</span>
        <h4 className="font-jakarta text-sm font-bold text-gray-900">{title}</h4>
      </div>
      <div className="space-y-2.5">
        {items.map((item, index) => (
          <div key={index} className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-gray-50 p-3">
            <p className={`font-jakarta text-sm leading-relaxed text-gray-650 ${quote ? "italic" : ""}`}>{quote ? `"${item}"` : item}</p>
            <CopyButton text={item} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
