"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Mail, Linkedin, Phone, Zap, ArrowRight } from "lucide-react";
import EngineHeader from "@/components/app/EngineHeader";
import { Input, Textarea, Select } from "@/components/ui/FormFields";
import Button from "@/components/ui/Button";
import CopyButton from "@/components/ui/CopyButton";
import Badge from "@/components/ui/Badge";
import { AnalysisLoading, ErrorState } from "@/components/ui/States";
import type { ColdDMOutput, ColdMessage, ColdEmailMessage } from "@/types";
import { cn } from "@/lib/utils";

const toneOptions = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual & Friendly" },
  { value: "bold", label: "Bold & Direct" },
  { value: "friendly", label: "Warm & Friendly" },
  { value: "urgent", label: "Urgency-Driven" },
];

const platformOptions = [
  { value: "all", label: "All Platforms" },
  { value: "whatsapp", label: "WhatsApp Only" },
  { value: "linkedin", label: "LinkedIn Only" },
  { value: "email", label: "Email Only" },
];

interface FormState { product: string; targetAudience: string; tone: string; offer: string; platform: string; personalization: string; }
const defaultForm: FormState = { product: "", targetAudience: "", tone: "professional", offer: "", platform: "all", personalization: "" };

const variantLabels: Record<string, string> = { short: "Short", medium: "Medium", long: "Long" };
const variantColors: Record<string, string> = { short: "sage", medium: "cocoa", long: "midnight" };

export default function ColdDMPage() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<ColdDMOutput | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"whatsapp" | "linkedin" | "email" | "followup">("whatsapp");

  const validate = () => {
    const e: Partial<FormState> = {};
    if (!form.product.trim()) e.product = "Required";
    if (!form.targetAudience.trim()) e.targetAudience = "Required";
    if (!form.offer.trim()) e.offer = "Required";
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/generate/cold-dm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      setResult(data.data);
      setStatus("success");
      // Set tab to first available
      if (form.platform === "linkedin") setActiveTab("linkedin");
      else if (form.platform === "email") setActiveTab("email");
      else setActiveTab("whatsapp");
    } catch (err) { setErrorMessage(err instanceof Error ? err.message : "Failed"); setStatus("error"); }
  };

  const set = (f: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setForm((p) => ({ ...p, [f]: e.target.value })); if (errors[f]) setErrors((p) => ({ ...p, [f]: undefined })); };

  const availableTabs = result ? [
    result.whatsappMessages?.length && { id: "whatsapp", label: "WhatsApp", icon: Phone },
    result.linkedinMessages?.length && { id: "linkedin", label: "LinkedIn", icon: Linkedin },
    result.emailMessages?.length && { id: "email", label: "Email", icon: Mail },
    { id: "followup", label: "Follow-ups", icon: ArrowRight },
  ].filter(Boolean) as { id: string; label: string; icon: React.ElementType }[] : [];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <EngineHeader icon={<MessageSquare size={22} />} title="ColdDM AI" description="Generate high-converting outreach messages for WhatsApp, LinkedIn, and email. Short, medium, and long variants with follow-up sequences included." badge="Revenue Tool" badgeVariant="sage" accentColor="#10b981" />
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-black/6 bg-gray-50 p-6 space-y-5">
            <Textarea label="Product / Service" placeholder="What are you selling or offering?" rows={3} value={form.product} onChange={set("product")} error={errors.product} required charCount maxChars={500} />
            <Textarea label="Target Audience" placeholder="Who are you reaching out to? Their role, industry, pain point." rows={3} value={form.targetAudience} onChange={set("targetAudience")} error={errors.targetAudience} required />
            <Textarea label="Your Offer / Hook" placeholder="What's the specific value or offer you're leading with?" rows={3} value={form.offer} onChange={set("offer")} error={errors.offer} required charCount maxChars={500} />
            <Select label="Tone" options={toneOptions} value={form.tone} onChange={set("tone")} />
            <Select label="Platform" options={platformOptions} value={form.platform} onChange={set("platform")} />
            <Input label="Personalization Context" placeholder="e.g. They recently raised Series A, or run a restaurant chain" value={form.personalization} onChange={set("personalization")} hint="Optional — makes messages feel more human" />
          </div>
          <Button size="lg" fullWidth onClick={handleSubmit} loading={status === "loading"} icon={<MessageSquare size={15} />} iconPosition="right">
            {status === "loading" ? "Writing Messages…" : "Generate Outreach Messages"}
          </Button>
          <p className="font-jakarta text-xs text-gray-400 text-center">
            Generates 3 variants per platform — short, medium, and long
          </p>
        </div>

        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full min-h-64 rounded-2xl border border-dashed border-black/8 p-10 text-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center"><MessageSquare size={20} className="text-emerald-700" /></div>
                <div><p className="font-bricolage text-sm font-semibold text-gray-800 mb-1">Ready to write</p><p className="font-jakarta text-sm text-gray-400 max-w-xs">Fill in your product, audience, and offer to generate outreach messages that actually get replies.</p></div>
              </motion.div>
            )}
            {status === "loading" && <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><AnalysisLoading engine="cold-dm" /></motion.div>}
            {status === "error" && <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><ErrorState message={errorMessage} onRetry={() => setStatus("idle")} /></motion.div>}
            {status === "success" && result && (
              <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                {/* Tabs */}
                {availableTabs.length > 0 && (
                  <div className="flex gap-1 p-1 rounded-xl border border-black/6 bg-gray-50 w-fit">
                    {availableTabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bricolage text-xs font-semibold transition-all", activeTab === tab.id ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "text-gray-400 hover:text-gray-600")}>
                          <Icon size={12} />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* WhatsApp messages */}
                {activeTab === "whatsapp" && result.whatsappMessages && (
                  <MessageVariantList messages={result.whatsappMessages} platform="WhatsApp" color="#25D366" />
                )}

                {/* LinkedIn messages */}
                {activeTab === "linkedin" && result.linkedinMessages && (
                  <MessageVariantList messages={result.linkedinMessages} platform="LinkedIn" color="#0A66C2" />
                )}

                {/* Email messages */}
                {activeTab === "email" && result.emailMessages && (
                  <div className="space-y-4">
                    {result.emailMessages.map((email) => <EmailCard key={email.variant} email={email} />)}
                  </div>
                )}

                {/* Follow-ups */}
                {activeTab === "followup" && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                      <h4 className="font-bricolage text-sm font-bold text-gray-800 mb-4">Follow-up Sequence</h4>
                      <div className="space-y-3">
                        {result.followUpVariants.map((msg, i) => (
                          <div key={i} className="p-4 rounded-xl border border-black/6 bg-gray-50">
                            <div className="flex items-center justify-between mb-2.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bricolage text-xs font-bold text-amber-700">Follow-up #{i + 1}</span>
                              </div>
                              <CopyButton text={msg} showLabel />
                            </div>
                            <p className="font-jakarta text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{msg}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CTA Variations */}
                    {result.ctaVariations.length > 0 && (
                      <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
                        <div className="flex items-center gap-2 mb-4"><Zap size={14} className="text-emerald-600" /><h4 className="font-bricolage text-sm font-bold text-gray-800">CTA Variations</h4></div>
                        <div className="flex flex-wrap gap-2">{result.ctaVariations.map((cta, i) => (
                          <div key={i} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-black/8 bg-gray-50">
                            <span className="font-jakarta text-sm text-gray-600">{cta}</span>
                            <CopyButton text={cta} size="sm" />
                          </div>
                        ))}</div>
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

function MessageVariantList({ messages, platform, color }: { messages: ColdMessage[]; platform: string; color: string }) {
  return (
    <div className="space-y-4">
      {messages.map((msg) => (
        <div key={msg.variant} className="rounded-2xl border border-black/6 bg-gray-50 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-jakarta text-xs" style={{ color }}>{platform}</span>
              <Badge variant={variantColors[msg.variant] as "sage" | "cocoa" | "midnight"} size="sm">{variantLabels[msg.variant]}</Badge>
            </div>
            <CopyButton text={msg.content} showLabel label="Copy message" />
          </div>
          <p className="font-jakarta text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        </div>
      ))}
    </div>
  );
}

function EmailCard({ email }: { email: ColdEmailMessage }) {
  const fullContent = `Subject: ${email.subject}\n\n${email.body}`;
  return (
    <div className="rounded-2xl border border-black/6 bg-gray-50 p-5">
      <div className="flex items-center justify-between mb-3">
        <Badge variant={variantColors[email.variant] as "sage" | "cocoa" | "midnight"} size="sm">{variantLabels[email.variant]}</Badge>
        <CopyButton text={fullContent} showLabel label="Copy email" />
      </div>
      <div className="space-y-3">
        <div className="p-3 rounded-lg border border-black/6 bg-gray-50">
          <p className="font-bricolage text-xs font-semibold text-gray-400 mb-1">Subject</p>
          <p className="font-jakarta text-sm text-gray-800">{email.subject}</p>
        </div>
        <div className="p-3 rounded-lg border border-black/6 bg-gray-50">
          <p className="font-bricolage text-xs font-semibold text-gray-400 mb-2">Body</p>
          <p className="font-jakarta text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{email.body}</p>
        </div>
      </div>
    </div>
  );
}
