"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, MessageSquare, BookOpen, Zap, Send, CheckCircle2 } from "lucide-react";
import { Input, Textarea, Select } from "@/components/ui/FormFields";
import Button from "@/components/ui/Button";
import AnimatedSection, { StaggerContainer, StaggerItem } from "@/components/shared/AnimatedSection";
import toast from "react-hot-toast";

const supportChannels = [
  {
    icon: Mail,
    title: "Email Support",
    description: "For account issues, billing, and general enquiries.",
    detail: "support@startupxai.com",
    color: "#72845e",
    response: "Response within 24h",
  },
  {
    icon: MessageSquare,
    title: "Live Chat",
    description: "Chat with our team directly inside the app dashboard.",
    detail: "Available Mon–Fri, 9am–6pm IST",
    color: "#9e724e",
    response: "Response within 2h",
  },
  {
    icon: BookOpen,
    title: "Documentation",
    description: "Step-by-step guides for every engine and feature.",
    detail: "docs.startupxai.com",
    color: "#4a63b5",
    response: "Always available",
  },
];

const subjectOptions = [
  { value: "general", label: "General Question" },
  { value: "bug", label: "Bug Report" },
  { value: "billing", label: "Billing & Subscription" },
  { value: "feature", label: "Feature Request" },
  { value: "enterprise", label: "Enterprise / Agency Enquiry" },
  { value: "privacy", label: "Privacy / Data Request" },
  { value: "other", label: "Other" },
];

export default function SupportPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email";
    if (!form.subject) e.subject = "Select a subject";
    if (!form.message.trim()) e.message = "Message is required";
    else if (form.message.trim().length < 20) e.message = "Message must be at least 20 characters";
    return e;
  };

  const handleSubmit = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    // Simulate submission
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    setSubmitted(true);
    toast.success("Message sent! We'll get back to you shortly.");
  };

  return (
    <div className="pt-28 pb-20 px-5">
      <div className="container-custom max-w-5xl">
        {/* Header */}
        <AnimatedSection className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-sage-800/50 bg-sage-950/40 mb-6">
            <Zap size={11} className="text-emerald-600" />
            <span className="font-bricolage text-xs font-semibold text-emerald-600">
              We&apos;re here to help
            </span>
          </div>
          <h1 className="font-bricolage text-4xl sm:text-5xl font-bold text-gray-800 tracking-tight mb-4">
            Support & Contact
          </h1>
          <p className="font-jakarta text-lg text-gray-500 max-w-xl mx-auto">
            Have a question, found a bug, or want to explore enterprise options?
            We&apos;re a team of founders too — we respond fast.
          </p>
        </AnimatedSection>

        {/* Support channels */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16" staggerDelay={0.08}>
          {supportChannels.map((ch) => {
            const Icon = ch.icon;
            return (
              <StaggerItem key={ch.title}>
                <div className="rounded-2xl border border-black/6 bg-gray-50 p-6 h-full">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${ch.color}15`, border: `1px solid ${ch.color}25` }}
                  >
                    <Icon size={18} style={{ color: ch.color }} />
                  </div>
                  <h3 className="font-bricolage text-sm font-bold text-gray-800 mb-1.5">
                    {ch.title}
                  </h3>
                  <p className="font-jakarta text-sm text-gray-500 mb-3 leading-relaxed">
                    {ch.description}
                  </p>
                  <p className="font-bricolage text-sm font-semibold" style={{ color: ch.color }}>
                    {ch.detail}
                  </p>
                  <p className="font-jakarta text-xs text-gray-500 mt-1">
                    {ch.response}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        {/* Contact form */}
        <AnimatedSection id="contact">
          <div className="max-w-2xl mx-auto">
            <div className="rounded-2xl border border-black/8 bg-gray-50 p-8">
              <h2 className="font-bricolage text-2xl font-bold text-gray-800 mb-2">
                Send us a message
              </h2>
              <p className="font-jakarta text-sm text-gray-500 mb-8">
                We typically respond within 24 hours on business days.
              </p>

              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-4 py-10 text-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-sage-900/30 border border-sage-700/30 flex items-center justify-center">
                    <CheckCircle2 size={24} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-bricolage text-lg font-bold text-gray-800 mb-1.5">
                      Message sent successfully
                    </p>
                    <p className="font-jakarta text-sm text-gray-500">
                      We&apos;ve received your message and will reply to{" "}
                      <span className="text-gray-800">{form.email}</span> shortly.
                    </p>
                  </div>
                  <button
                    onClick={() => { setSubmitted(false); setForm({ name: "", email: "", subject: "", message: "" }); }}
                    className="font-bricolage text-sm font-semibold text-emerald-600 hover:text-emerald-600 transition-colors mt-2"
                  >
                    Send another message
                  </button>
                </motion.div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Your Name"
                      placeholder="Alex Chen"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      error={errors.name}
                      required
                    />
                    <Input
                      label="Email Address"
                      type="email"
                      placeholder="alex@startup.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      error={errors.email}
                      required
                    />
                  </div>
                  <Select
                    label="Subject"
                    options={subjectOptions}
                    placeholder="Select a subject"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    error={errors.subject}
                    required
                  />
                  <Textarea
                    label="Message"
                    placeholder="Describe your question or issue in detail..."
                    rows={6}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    error={errors.message}
                    charCount
                    maxChars={2000}
                    required
                  />
                  <Button
                    size="lg"
                    loading={loading}
                    onClick={handleSubmit}
                    icon={<Send size={15} />}
                    iconPosition="right"
                    fullWidth
                  >
                    {loading ? "Sending…" : "Send Message"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
}
