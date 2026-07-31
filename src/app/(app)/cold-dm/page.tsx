"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Mail, MessageSquare, Phone, Send, Target, Zap } from "lucide-react";
import EngineHeader from "@/components/app/EngineHeader";
import { Input, Select, Textarea } from "@/components/ui/FormFields";
import Button from "@/components/ui/Button";
import CopyButton from "@/components/ui/CopyButton";
import Badge from "@/components/ui/Badge";
import ExportPdfButton from "@/components/ui/ExportPdfButton";
import { MagicBentoCard, MagicBentoGrid } from "@/components/ui/MagicBento";
import { AnalysisLoading, ErrorState } from "@/components/ui/States";
import type { ColdDMOutput, ColdEmailMessage, ColdMessage } from "@/types";
import { cn } from "@/lib/utils";
import { logUsageClient } from "@/lib/usage-client";
import { getAuthHeaders } from "@/lib/auth-headers-client";

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

interface FormState {
  product: string;
  targetAudience: string;
  tone: string;
  offer: string;
  platform: string;
  personalization: string;
}

const defaultForm: FormState = {
  product: "",
  targetAudience: "",
  tone: "professional",
  offer: "",
  platform: "all",
  personalization: "",
};

const variantLabels: Record<string, string> = { short: "Short", medium: "Medium", long: "Long" };
const variantColors: Record<string, "sage" | "cocoa" | "midnight"> = { short: "sage", medium: "cocoa", long: "midnight" };

type TabId = "whatsapp" | "linkedin" | "email" | "followup";

export default function ColdDMPage() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<ColdDMOutput | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("whatsapp");

  const validate = () => {
    const e: Partial<FormState> = {};
    if (!form.product.trim()) e.product = "Required";
    if (!form.targetAudience.trim()) e.targetAudience = "Required";
    if (!form.offer.trim()) e.offer = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (status === "loading") return;
    if (!validate()) return;
    setStatus("loading");

    try {
      const res = await fetch("/api/generate/cold-dm", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Message generation failed");
      setResult(data.data);
      setStatus("success");
      logUsageClient("cold-dm");

      if (form.platform === "linkedin") setActiveTab("linkedin");
      else if (form.platform === "email") setActiveTab("email");
      else setActiveTab("whatsapp");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Message generation failed");
      setStatus("error");
    }
  };

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  };

  const availableTabs = result
    ? ([
        result.whatsappMessages?.length && { id: "whatsapp", label: "WhatsApp", icon: Phone },
        result.linkedinMessages?.length && { id: "linkedin", label: "LinkedIn", icon: Send },
        result.emailMessages?.length && { id: "email", label: "Email", icon: Mail },
        { id: "followup", label: "Follow-ups", icon: ArrowRight },
      ].filter(Boolean) as { id: TabId; label: string; icon: React.ElementType }[])
    : [];

  const sequenceText = useMemo(() => {
    if (!result) return "";

    const messages = (label: string, items?: ColdMessage[]) =>
      items?.length
        ? [label, ...items.map((message) => `- ${variantLabels[message.variant]} (${message.tone}):\n${message.content}`)].join("\n")
        : "";

    return [
      "StartupX AI - Cold Outreach Pack",
      "",
      `Product / Service: ${form.product}`,
      `Target Audience: ${form.targetAudience}`,
      `Offer / Hook: ${form.offer}`,
      `Tone: ${form.tone}`,
      form.personalization ? `Personalization: ${form.personalization}` : "",
      "",
      messages("WhatsApp Messages", result.whatsappMessages),
      "",
      messages("LinkedIn Messages", result.linkedinMessages),
      "",
      result.emailMessages?.length
        ? [
            "Email Messages",
            ...result.emailMessages.map((email) => `- ${variantLabels[email.variant]}\nSubject: ${email.subject}\n\n${email.body}`),
          ].join("\n")
        : "",
      "",
      "Follow-up Sequence",
      ...result.followUpVariants.map((message, index) => `${index + 1}. ${message}`),
      "",
      "CTA Variations",
      ...result.ctaVariations.map((cta) => `- ${cta}`),
    ]
      .filter((line) => line !== "")
      .join("\n");
  }, [form, result]);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <EngineHeader
        icon={<MessageSquare size={22} />}
        title="ColdDM"
        description="Generate reply-focused outreach for WhatsApp, LinkedIn, and email with variants, follow-ups, and CTA options."
        badge="Revenue Tool"
        badgeVariant="sage"
        accentColor="#10b981"
      />

      <MagicBentoGrid className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3" preset="app" glowColor="16, 185, 129" spotlightOpacity={0.07}>
        <ContextCard icon={<Target size={16} />} title="Audience fit" detail="Messages shaped to buyer pain" tone="emerald" />
        <ContextCard icon={<MessageSquare size={16} />} title="Platform variants" detail="WhatsApp, LinkedIn, email" tone="blue" />
        <ContextCard icon={<ArrowRight size={16} />} title="Follow-up system" detail="Replies without sounding pushy" tone="amber" />
      </MagicBentoGrid>

      <div className="mt-8 space-y-8">
        <div className={status === "idle" ? "mx-auto max-w-4xl space-y-5" : "hidden"}>
          <div className="rounded-2xl border border-black/6 bg-white p-6 shadow-sm shadow-gray-200/50 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-jakarta text-base font-bold text-gray-900">Outreach context</h3>
                <p className="mt-1 font-jakarta text-xs text-gray-500">Give the engine the buyer, offer, tone, and personalization angle.</p>
              </div>
              <Badge variant="sage" size="sm">
                3 required
              </Badge>
            </div>

            <Textarea label="Product / Service" placeholder="What are you selling or offering?" rows={3} value={form.product} onChange={set("product")} error={errors.product} required charCount maxChars={500} />
            <Textarea
              label="Target Audience"
              placeholder="Who are you reaching out to? Their role, industry, pain point."
              rows={3}
              value={form.targetAudience}
              onChange={set("targetAudience")}
              error={errors.targetAudience}
              required
            />
            <Textarea label="Your Offer / Hook" placeholder="What's the specific value or offer you're leading with?" rows={3} value={form.offer} onChange={set("offer")} error={errors.offer} required charCount maxChars={500} />
            <Select label="Tone" options={toneOptions} value={form.tone} onChange={set("tone")} />
            <Select label="Platform" options={platformOptions} value={form.platform} onChange={set("platform")} />
            <Input
              label="Personalization Context"
              placeholder="e.g. They recently raised Series A, or run a restaurant chain"
              value={form.personalization}
              onChange={set("personalization")}
              hint="Optional - makes messages feel more human"
            />
          </div>

          <Button size="lg" fullWidth onClick={handleSubmit} loading={status === "loading"} icon={<MessageSquare size={15} />} iconPosition="right">
            {status === "loading" ? "Writing messages..." : "Generate Outreach Messages"}
          </Button>
          <p className="text-center font-jakarta text-xs text-gray-400">Generates short, medium, and long variants where platform output is available.</p>
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
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50">
                  <MessageSquare size={22} className="text-emerald-700" />
                </div>
                <p className="mt-4 font-jakarta text-base font-bold text-gray-900">Ready to write outreach</p>
                <p className="mt-2 max-w-sm font-jakarta text-sm leading-relaxed text-gray-500">
                  Add your product, buyer, and offer to generate messages that are specific, clear, and easy to send.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {["WhatsApp", "LinkedIn", "Email"].map((label) => (
                    <Badge key={label} variant="sage" size="sm">
                      {label}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            )}

            {status === "loading" && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AnalysisLoading engine="cold-dm" />
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
                <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-jakarta text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Outreach pack</p>
                      <h3 className="mt-1 font-jakarta text-xl font-bold text-gray-950">{form.product || "Cold outreach"}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2 no-print">
                      <Button variant="outline" size="sm" onClick={() => setStatus("idle")}>Edit inputs</Button>
                      <Button variant="outline" size="sm" onClick={() => handleSubmit()}>Run again</Button>
                      <ExportPdfButton />
                      <CopyButton text={sequenceText} showLabel label="Copy pack" />
                    </div>
                  </div>
                </div>

                {availableTabs.length > 0 && (
                  <div className="flex w-fit flex-wrap gap-1 rounded-xl border border-black/6 bg-white p-1 shadow-sm shadow-gray-200/40">
                    {availableTabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-jakarta text-xs font-semibold transition-all",
                            activeTab === tab.id ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800",
                          )}
                        >
                          <Icon size={12} />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {activeTab === "whatsapp" && result.whatsappMessages && <MessageVariantList messages={result.whatsappMessages} platform="WhatsApp" color="#16a34a" />}
                {activeTab === "linkedin" && result.linkedinMessages && <MessageVariantList messages={result.linkedinMessages} platform="LinkedIn" color="#0A66C2" />}
                {activeTab === "email" && result.emailMessages && (
                  <div className="space-y-4">
                    {result.emailMessages.map((email) => (
                      <EmailCard key={email.variant} email={email} />
                    ))}
                  </div>
                )}

                {activeTab === "followup" && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                      <div className="mb-4 flex items-center gap-2">
                        <ArrowRight size={14} className="text-amber-700" />
                        <h4 className="font-jakarta text-sm font-bold text-gray-900">Follow-up Sequence</h4>
                      </div>
                      <div className="space-y-3">
                        {result.followUpVariants.map((message, index) => (
                          <div key={index} className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                            <div className="mb-2.5 flex items-center justify-between gap-3">
                              <span className="font-jakarta text-xs font-bold text-amber-700">Follow-up #{index + 1}</span>
                              <CopyButton text={message} showLabel />
                            </div>
                            <p className="whitespace-pre-wrap font-jakarta text-sm leading-relaxed text-gray-650">{message}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {result.ctaVariations.length > 0 && (
                      <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
                        <div className="mb-4 flex items-center gap-2">
                          <Zap size={14} className="text-emerald-600" />
                          <h4 className="font-jakarta text-sm font-bold text-gray-900">CTA Variations</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {result.ctaVariations.map((cta, index) => (
                            <div key={index} className="flex items-center gap-1.5 rounded-xl border border-black/8 bg-gray-50 px-3 py-2">
                              <span className="font-jakarta text-sm text-gray-650">{cta}</span>
                              <CopyButton text={cta} size="sm" />
                            </div>
                          ))}
                        </div>
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

function ContextCard({ title, detail }: { icon: React.ReactNode; title: string; detail: string; tone: "emerald" | "blue" | "amber" }) {
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

function MessageVariantList({ messages, platform, color }: { messages: ColdMessage[]; platform: string; color: string }) {
  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div key={message.variant} className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-jakarta text-xs font-semibold" style={{ color }}>
                {platform}
              </span>
              <Badge variant={variantColors[message.variant]} size="sm">
                {variantLabels[message.variant]}
              </Badge>
              <Badge variant="neutral" size="sm">
                {message.tone}
              </Badge>
            </div>
            <CopyButton text={message.content} showLabel label="Copy message" />
          </div>
          <p className="whitespace-pre-wrap font-jakarta text-sm leading-relaxed text-gray-650">{message.content}</p>
        </div>
      ))}
    </div>
  );
}

function EmailCard({ email }: { email: ColdEmailMessage }) {
  const fullContent = `Subject: ${email.subject}\n\n${email.body}`;

  return (
    <div className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm shadow-gray-200/50">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Badge variant={variantColors[email.variant]} size="sm">
          {variantLabels[email.variant]}
        </Badge>
        <CopyButton text={fullContent} showLabel label="Copy email" />
      </div>
      <div className="space-y-3">
        <div className="rounded-lg border border-black/6 bg-gray-50 p-3">
          <p className="mb-1 font-jakarta text-xs font-semibold text-gray-400">Subject</p>
          <p className="font-jakarta text-sm text-gray-900">{email.subject}</p>
        </div>
        <div className="rounded-lg border border-black/6 bg-gray-50 p-3">
          <p className="mb-2 font-jakarta text-xs font-semibold text-gray-400">Body</p>
          <p className="whitespace-pre-wrap font-jakarta text-sm leading-relaxed text-gray-650">{email.body}</p>
        </div>
      </div>
    </div>
  );
}
