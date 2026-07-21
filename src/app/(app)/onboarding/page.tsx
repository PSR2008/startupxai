"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Compass, Globe, Lightbulb, Loader2, Target, Zap } from "lucide-react";
import { Input, Select, Textarea } from "@/components/ui/FormFields";
import Button from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

const industryOptions = [
  { value: "", label: "Select industry" },
  { value: "saas", label: "SaaS / Software" },
  { value: "ai-ml", label: "AI / Machine Learning" },
  { value: "fintech", label: "Fintech" },
  { value: "edtech", label: "Edtech" },
  { value: "healthtech", label: "Healthtech" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "marketplace", label: "Marketplace" },
  { value: "consumer", label: "Consumer App" },
  { value: "b2b", label: "B2B Services" },
  { value: "other", label: "Other" },
];

const stageOptions = [
  { value: "", label: "Select stage" },
  { value: "idea", label: "Idea stage" },
  { value: "pre-product", label: "Pre-product" },
  { value: "mvp", label: "MVP / prototype" },
  { value: "launched", label: "Launched" },
  { value: "growing", label: "Growing" },
];

const goalOptions = [
  { value: "", label: "Select primary goal" },
  { value: "validate", label: "Assess assumptions" },
  { value: "position", label: "Improve positioning" },
  { value: "revenue", label: "Find pricing and revenue model" },
  { value: "growth", label: "Get first customers" },
  { value: "fundraise", label: "Prepare for fundraising" },
];

interface FormState {
  startup_idea: string;
  product_summary: string;
  target_audience: string;
  industry: string;
  founder_stage: string;
  region: string;
  primary_goal: string;
}

const defaultForm: FormState = {
  startup_idea: "",
  product_summary: "",
  target_audience: "",
  industry: "",
  founder_stage: "",
  region: "",
  primary_goal: "",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/signin");
        return;
      }

      setToken(session.access_token);
      const res = await fetch("/api/founder-profile", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (data.profile) {
        setForm({
          startup_idea: data.profile.startup_idea ?? "",
          product_summary: data.profile.product_summary ?? "",
          target_audience: data.profile.target_audience ?? "",
          industry: data.profile.industry ?? "",
          founder_stage: data.profile.founder_stage ?? "",
          region: data.profile.region ?? "",
          primary_goal: data.profile.primary_goal ?? "",
        });
      }

      setLoading(false);
    }

    load();
  }, [router]);

  const setField =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const validate = () => {
    const nextErrors: Partial<FormState> = {};
    if (!form.startup_idea.trim()) nextErrors.startup_idea = "Startup idea is required";
    if (!form.product_summary.trim()) nextErrors.product_summary = "Product summary is required";
    if (!form.target_audience.trim()) nextErrors.target_audience = "Target audience is required";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const save = async () => {
    if (!validate() || !token) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/founder-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Unable to save onboarding");

      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save onboarding");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="rounded-2xl border border-black/6 bg-white p-8 shadow-sm flex items-center gap-2 text-gray-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="font-jakarta text-sm">Preparing onboarding...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <Compass size={18} className="text-emerald-600" />
          </div>
          <span className="font-bricolage text-xs font-bold text-emerald-600 uppercase tracking-widest">
            Founder setup
          </span>
        </div>
        <h1 className="font-bricolage text-3xl font-bold text-gray-900 mb-2">Set up your evidence workspace</h1>
        <p className="font-jakarta text-sm text-gray-500 max-w-2xl">
          Tell us what you are building once. We will prefill assessment tools and tune the dashboard around your startup context.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-black/6 bg-white p-7 shadow-sm space-y-5"
        >
          <Input
            label="Startup idea"
            placeholder="e.g. Hiring workflow assistant for remote software teams"
            value={form.startup_idea}
            onChange={setField("startup_idea")}
            error={errors.startup_idea}
            required
          />
          <Textarea
            label="Product summary"
            placeholder="What does it do, what pain does it solve, and how does it work?"
            rows={5}
            value={form.product_summary}
            onChange={setField("product_summary")}
            error={errors.product_summary}
            required
            charCount
            maxChars={1600}
          />
          <Textarea
            label="Target audience"
            placeholder="Who is the exact buyer or user?"
            rows={3}
            value={form.target_audience}
            onChange={setField("target_audience")}
            error={errors.target_audience}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Industry" options={industryOptions} value={form.industry} onChange={setField("industry")} />
            <Select label="Stage" options={stageOptions} value={form.founder_stage} onChange={setField("founder_stage")} />
            <Input label="Region" placeholder="e.g. US, India, Europe" value={form.region} onChange={setField("region")} />
            <Select label="Primary goal" options={goalOptions} value={form.primary_goal} onChange={setField("primary_goal")} />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="font-jakarta text-sm text-rose-700">{error}</p>
            </div>
          )}

          <Button size="lg" fullWidth onClick={save} loading={saving} icon={<ArrowRight size={15} />} iconPosition="right">
            Save and open dashboard
          </Button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-4">
          {[
            { icon: Lightbulb, title: "Prefilled assessment tools", text: "Evidence, Idea, Revenue, and Growth start with your context." },
            { icon: Target, title: "Clearer findings", text: "Better baseline context means more specific reports." },
            { icon: Globe, title: "Market awareness", text: "Region and stage help shape practical next moves." },
            { icon: Zap, title: "Reusable setup", text: "Update this later from onboarding whenever your idea changes." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-black/6 bg-white p-5 shadow-sm">
              <Icon size={16} className="text-emerald-600 mb-3" />
              <p className="font-bricolage text-sm font-bold text-gray-900 mb-1">{title}</p>
              <p className="font-jakarta text-xs text-gray-500 leading-relaxed">{text}</p>
            </div>
          ))}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <CheckCircle2 size={17} className="text-emerald-700 mb-3" />
            <p className="font-jakarta text-xs text-emerald-700 leading-relaxed">
              You can still edit every workflow input before reviewing findings.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
