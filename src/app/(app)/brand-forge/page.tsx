"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Palette, Sparkles, Type, Volume2, Layers } from "lucide-react";
import EngineHeader from "@/components/app/EngineHeader";
import { Input, Textarea, Select } from "@/components/ui/FormFields";
import Button from "@/components/ui/Button";
import CopyButton from "@/components/ui/CopyButton";
import Badge from "@/components/ui/Badge";
import { AnalysisLoading, ErrorState } from "@/components/ui/States";
import type { BrandForgeOutput, BrandName } from "@/types";

const toneOptions = [
  { value: "premium", label: "Premium / Luxury" },
  { value: "playful", label: "Playful & Fun" },
  { value: "bold", label: "Bold & Disruptive" },
  { value: "minimal", label: "Minimal & Clean" },
  { value: "technical", label: "Technical / Expert" },
  { value: "warm", label: "Warm & Human" },
];

interface FormState { idea: string; tone: string; industry: string; targetUser: string; vibeKeywords: string; }
const defaultForm: FormState = { idea: "", tone: "premium", industry: "", targetUser: "", vibeKeywords: "" };

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
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setStatus("loading"); setSelectedName(null);
    try {
      const res = await fetch("/api/generate/brand-forge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      setResult(data.data); setStatus("success");
    } catch (err) { setErrorMessage(err instanceof Error ? err.message : "Failed"); setStatus("error"); }
  };

  const set = (f: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setForm((p) => ({ ...p, [f]: e.target.value })); if (errors[f]) setErrors((p) => ({ ...p, [f]: undefined })); };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <EngineHeader icon={<Palette size={22} />} title="BrandForge AI" description="Generate startup names, taglines, positioning lines, brand personality, and a color direction. Your brand identity in seconds." badge="Revenue Tool" badgeVariant="cocoa" accentColor="#7c3aed" />
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-black/6 bg-gray-50 p-6 space-y-5">
            <Textarea label="Startup Idea" placeholder="What does your startup do? What problem does it solve?" rows={3} value={form.idea} onChange={set("idea")} error={errors.idea} required charCount maxChars={500} />
            <Select label="Brand Tone" options={toneOptions} value={form.tone} onChange={set("tone")} required />
            <Input label="Industry" placeholder="e.g. Fintech, EdTech, Consumer SaaS" value={form.industry} onChange={set("industry")} error={errors.industry} required />
            <Textarea label="Target User" placeholder="Who is your ideal customer? Their vibe, job, lifestyle." rows={3} value={form.targetUser} onChange={set("targetUser")} error={errors.targetUser} required />
            <Input label="Vibe Keywords" placeholder="e.g. bold, minimalist, human, trustworthy, fast, elite" value={form.vibeKeywords} onChange={set("vibeKeywords")} error={errors.vibeKeywords} hint="3–6 words that capture the feel you want" required />
          </div>
          <Button size="lg" fullWidth onClick={handleSubmit} loading={status === "loading"} icon={<Palette size={15} />} iconPosition="right">
            {status === "loading" ? "Forging Brand…" : "Generate Brand Identity"}
          </Button>
        </div>

        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full min-h-64 rounded-2xl border border-dashed border-black/8 p-10 text-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center"><Palette size={20} className="text-amber-600" /></div>
                <div><p className="font-bricolage text-sm font-semibold text-gray-800 mb-1">Branding ready to forge</p><p className="font-jakarta text-sm text-gray-400 max-w-xs">Fill in your idea and vibe, and get 5 brand name options with a full brand pack.</p></div>
              </motion.div>
            )}
            {status === "loading" && <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><AnalysisLoading engine="brand-forge" /></motion.div>}
            {status === "error" && <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><ErrorState message={errorMessage} onRetry={() => setStatus("idle")} /></motion.div>}
            {status === "success" && result && (
              <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                {/* Name options */}
                <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                  <div className="flex items-center gap-2 mb-4"><Type size={14} className="text-amber-700" /><h3 className="font-bricolage text-sm font-bold text-gray-800">Brand Name Options</h3></div>
                  <div className="space-y-3">
                    {result.startupNames.map((name) => (
                      <motion.div
                        key={name.name}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => setSelectedName(selectedName === name.name ? null : name.name)}
                        className={`rounded-xl border p-4 cursor-pointer transition-all ${selectedName === name.name ? "border-amber-200 bg-amber-50" : "border-black/6 bg-gray-50 hover:border-black/12"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bricolage text-lg font-bold text-gray-900">{name.name}</p>
                            <p className="font-jakarta text-xs text-gray-400 mt-0.5 italic">{name.vibe}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <CopyButton text={name.name} size="sm" />
                          </div>
                        </div>
                        <AnimatePresence>
                          {selectedName === name.name && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="mt-3 pt-3 border-t border-black/6 space-y-2">
                                <p className="font-jakarta text-sm text-gray-600">{name.rationale}</p>
                                {name.domain && <p className="font-jakarta text-xs text-gray-400">{name.domain}</p>}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Taglines */}
                <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                  <div className="flex items-center gap-2 mb-4"><Sparkles size={14} className="text-emerald-600" /><h4 className="font-bricolage text-sm font-bold text-gray-800">Taglines</h4></div>
                  <div className="space-y-2.5">
                    {result.taglines.map((tag, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-black/5 bg-gray-50">
                        <p className="font-jakarta text-sm text-gray-500 italic">&ldquo;{tag}&rdquo;</p>
                        <CopyButton text={tag} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Positioning lines */}
                <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                  <div className="flex items-center gap-2 mb-4"><Layers size={14} className="text-blue-600" /><h4 className="font-bricolage text-sm font-bold text-gray-800">Positioning Lines</h4></div>
                  <div className="space-y-2">
                    {result.positioningLines.map((line, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-black/5 bg-gray-50">
                        <p className="font-jakarta text-sm text-gray-600">{line}</p>
                        <CopyButton text={line} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tone of voice & Brand personality */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3"><Volume2 size={13} className="text-amber-700" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase">Tone of Voice</h4></div>
                    <p className="font-jakarta text-sm text-gray-600 leading-relaxed">{result.toneOfVoice}</p>
                  </div>
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3"><Sparkles size={13} className="text-emerald-600" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase">Brand Personality</h4></div>
                    <div className="space-y-2">{result.brandPersonality.map((t, i) => <Badge key={i} variant="sage" size="md" className="w-full justify-start whitespace-normal h-auto py-1.5">{t}</Badge>)}</div>
                  </div>
                </div>

                {/* Color direction */}
                {result.colorDirection && (
                  <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-4"><Palette size={14} className="text-amber-700" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide">Color Direction</h4></div>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[
                        { label: "Primary", value: result.colorDirection.primary },
                        { label: "Secondary", value: result.colorDirection.secondary },
                        { label: "Accent", value: result.colorDirection.accent },
                      ].map((c) => (
                        <div key={c.label} className="text-center">
                          <p className="font-bricolage text-[10px] font-bold text-gray-400 uppercase mb-1.5">{c.label}</p>
                          <p className="font-jakarta text-xs text-gray-600">{c.value}</p>
                        </div>
                      ))}
                    </div>
                    <p className="font-jakarta text-xs text-gray-400 mb-3">{result.colorDirection.mood}</p>
                    {result.colorDirection.hexSuggestions.length > 0 && (
                      <div className="flex gap-2">
                        {result.colorDirection.hexSuggestions.map((hex) => (
                          <div key={hex} className="flex flex-col items-center gap-1">
                            <div className="w-8 h-8 rounded-lg border border-black/10 shadow-md" style={{ background: hex }} title={hex} />
                            <span className="font-mono text-[9px] text-gray-400">{hex}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Brand pack summary */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2"><Sparkles size={13} className="text-amber-700" /><h4 className="font-bricolage text-xs font-bold text-gray-700 uppercase tracking-wide">Brand Pack Summary</h4></div>
                    <CopyButton text={result.brandPackSummary} showLabel label="Copy brief" />
                  </div>
                  <p className="font-jakarta text-sm text-gray-600 leading-relaxed">{result.brandPackSummary}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
