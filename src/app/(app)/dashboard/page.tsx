"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FileText,
  FlaskConical,
  Lightbulb,
  MessageSquare,
  SearchCheck,
  Settings,
  ShieldCheck,
  Target,
} from "lucide-react";
import AnimatedSection, { StaggerContainer, StaggerItem } from "@/components/shared/AnimatedSection";
import UsageWidget from "@/components/app/UsageWidget";
import SubscriptionStatusCard from "@/components/app/SubscriptionStatusCard";
import RecentReports from "@/components/app/RecentReports";
import Badge from "@/components/ui/Badge";
import { MagicBentoCard, MagicBentoGrid } from "@/components/ui/MagicBento";
import { getAuthHeaders } from "@/lib/auth-headers-client";

interface FounderProfile {
  startup_idea: string;
  product_summary: string;
  target_audience: string;
  industry?: string | null;
  founder_stage?: string | null;
  region?: string | null;
  primary_goal?: string | null;
}

interface UsageSummary {
  plan: "free" | "founder" | "growth" | "scale";
}

const primaryActions = [
  { title: "Review evidence", description: "Open the core assessment workspace.", href: "/evidence-engine", icon: SearchCheck, tone: "emerald" as const },
  { title: "Assess assumptions", description: "Pressure-test idea, ICP, and demand logic.", href: "/idea-engine", icon: Lightbulb, tone: "blue" as const },
  { title: "Track an experiment", description: "Turn missing evidence into a measurable test.", href: "/evidence-engine#experiments", icon: FlaskConical, tone: "amber" as const },
  { title: "Review findings", description: "Open saved reports and decision history.", href: "/reports", icon: FileText, tone: "neutral" as const },
];

const secondaryTools = [
  { title: "Competitors", href: "/competitor-intelligence", icon: Target },
  { title: "Decisions", href: "/founder-decision", icon: ClipboardList },
  { title: "Outreach", href: "/cold-dm", icon: MessageSquare },
  { title: "Settings", href: "/profile", icon: Settings },
];

export default function DashboardPage() {
  const [profile, setProfile] = useState<FounderProfile | null>(null);
  const [usage, setUsage] = useState<UsageSummary>({ plan: "free" });

  useEffect(() => {
    async function loadDashboardState() {
      try {
        const headers = await getAuthHeaders();
        const [profileRes, usageRes] = await Promise.all([
          fetch("/api/founder-profile", { headers }),
          fetch("/api/check-usage", { headers }),
        ]);

        const profileData = await profileRes.json();
        if (profileRes.ok && profileData.profile) setProfile(profileData.profile);

        const usageData = await usageRes.json();
        if (usageRes.ok && usageData.plan) setUsage({ plan: usageData.plan });
      } catch {
        // best-effort dashboard context
      }
    }

    loadDashboardState();
  }, []);

  const setupItems = useMemo(() => [
    { label: "Startup context", complete: Boolean(profile?.startup_idea && profile?.product_summary) },
    { label: "Target customer", complete: Boolean(profile?.target_audience) },
    { label: "Region and stage", complete: Boolean(profile?.region || profile?.founder_stage) },
    { label: "Evidence project", complete: false },
  ], [profile]);

  const setupComplete = setupItems.filter((item) => item.complete).length;

  return (
    <div className="mx-auto max-w-7xl p-5 lg:p-8">
      <AnimatedSection className="mb-6">
        <div className="flex flex-col gap-4 border-b border-black/6 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="emerald" size="sm" dot>Founder operating system</Badge>
              <Badge variant={usage.plan === "free" ? "neutral" : "blue"} size="sm">{usage.plan} plan</Badge>
            </div>
            <h1 className="font-bricolage text-3xl font-bold tracking-tight text-gray-950">
              {profile?.startup_idea ? profile.startup_idea : "Evidence workspace"}
            </h1>
            <p className="mt-2 max-w-2xl font-jakarta text-sm leading-relaxed text-gray-600">
              {profile?.product_summary || "Set up your startup context, then start an evidence assessment before committing more build time."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/evidence-engine">
              <button className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 font-jakarta text-xs font-semibold text-white shadow-sm hover:bg-emerald-800">
                Start assessment <ArrowRight size={13} />
              </button>
            </Link>
            <Link href="/onboarding">
              <button className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-black/10 bg-white px-4 font-jakarta text-xs font-semibold text-gray-700 hover:bg-gray-50">
                Update context
              </button>
            </Link>
          </div>
        </div>
      </AnimatedSection>

      <StaggerContainer className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_0.65fr]" staggerDelay={0.05}>
        <StaggerItem>
          <section className="surface-panel p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-bricolage text-sm font-bold text-gray-900">Current project</p>
                <p className="font-jakarta text-xs text-gray-500">Your active founder context and next evidence step.</p>
              </div>
              <SearchCheck size={18} className="text-emerald-700" />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <ProjectField label="Audience" value={profile?.target_audience} fallback="No target customer recorded" />
              <ProjectField label="Market" value={profile?.region || profile?.industry} fallback="No market context recorded" />
              <ProjectField label="Stage" value={profile?.founder_stage} fallback="No stage recorded" />
            </div>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="font-bricolage text-xs font-bold text-amber-900">Next recommended action</p>
              <p className="mt-1 font-jakarta text-sm leading-relaxed text-amber-800">
                {profile ? "Create or update the Evidence Score, then add customer research before treating the assessment as reliable." : "Complete founder setup so evidence, reports, and recommendations have the right context."}
              </p>
            </div>
          </section>
        </StaggerItem>

        <StaggerItem>
          <section className="h-full rounded-xl border border-emerald-200/10 bg-[#10201b] p-5 text-white shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <p className="font-bricolage text-sm font-bold">Workspace health</p>
              <ShieldCheck size={17} className="text-emerald-300" />
            </div>
            <div className="mb-4 flex items-end gap-2">
              <span className="font-bricolage text-4xl font-bold">{setupComplete}</span>
              <span className="pb-1 font-jakarta text-sm text-white/55">/ {setupItems.length} ready</span>
            </div>
            <div className="space-y-2">
              {setupItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <span className="font-jakarta text-xs text-white/75">{item.label}</span>
                  <span className={`h-2 w-2 rounded-full ${item.complete ? "bg-emerald-300" : "bg-amber-300"}`} />
                </div>
              ))}
            </div>
          </section>
        </StaggerItem>
      </StaggerContainer>

      <AnimatedSection className="mb-6" delay={0.08}>
        <section className="surface-panel p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bricolage text-sm font-bold text-gray-900">Quick actions</p>
              <p className="font-jakarta text-xs text-gray-500">Move from uncertainty to recorded evidence.</p>
            </div>
            <Link href="/evidence-engine" className="font-bricolage text-xs font-bold text-emerald-700 hover:text-emerald-800">
              Open Evidence Engine
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {primaryActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href} className="group rounded-lg border border-black/6 bg-[#fbfaf7] p-4 transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-sm focus-ring">
                  <div className="mb-3 flex items-center justify-between">
                    <Icon size={16} className="text-gray-700" />
                    <Badge variant={action.tone} size="sm">Open</Badge>
                  </div>
                  <p className="font-bricolage text-sm font-bold text-gray-950">{action.title}</p>
                  <p className="mt-1 font-jakarta text-xs leading-relaxed text-gray-500">{action.description}</p>
                </Link>
              );
            })}
          </div>
        </section>
      </AnimatedSection>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <AnimatedSection delay={0.1}>
          <section className="surface-panel h-full p-5">
            <div className="mb-4 flex items-center gap-2">
              <FlaskConical size={15} className="text-amber-600" />
              <p className="font-bricolage text-sm font-bold text-gray-900">Experiments in progress</p>
            </div>
            <EmptyPanel
              title="No experiments recorded yet."
              description="Track an interview batch, landing-page test, pricing test, survey, or support-message review before raising confidence."
              href="/evidence-engine#experiments"
              action="Track an experiment"
            />
          </section>
        </AnimatedSection>

        <AnimatedSection delay={0.12}>
          <section className="surface-panel h-full p-5">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList size={15} className="text-blue-700" />
              <p className="font-bricolage text-sm font-bold text-gray-900">Open assumptions</p>
            </div>
            {profile?.primary_goal ? (
              <div className="rounded-lg border border-black/6 bg-[#fbfaf7] p-4">
                <p className="font-bricolage text-xs font-bold uppercase tracking-wide text-gray-500">Founder goal</p>
                <p className="mt-1 font-jakarta text-sm leading-relaxed text-gray-700">{profile.primary_goal}</p>
                <p className="mt-3 font-jakarta text-xs leading-relaxed text-gray-500">
                  Convert this into a testable assumption in the Evidence Engine so it can be tied to sources or experiment results.
                </p>
              </div>
            ) : (
              <EmptyPanel
                title="No assumptions recorded yet."
                description="Add the riskiest beliefs behind your idea so the workspace can show what is still unproven."
                href="/onboarding"
                action="Add assumptions"
              />
            )}
          </section>
        </AnimatedSection>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UsageWidget />
        <SubscriptionStatusCard />
      </div>

      <MagicBentoGrid className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" preset="app" glowColor="16, 185, 129">
        {secondaryTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <MagicBentoCard
              key={tool.href}
              href={tool.href}
              interactive
              className="surface-panel focus-ring p-4 transition-all hover:-translate-y-px hover:shadow-md"
              enableTilt
              clickEffect
            >
              <Icon size={15} className="mb-3 text-gray-600" />
              <p className="font-bricolage text-sm font-bold text-gray-900">{tool.title}</p>
            </MagicBentoCard>
          );
        })}
      </MagicBentoGrid>

      <AnimatedSection delay={0.14}>
        <RecentReports />
      </AnimatedSection>
    </div>
  );
}

function ProjectField({ label, value, fallback }: { label: string; value?: string | null; fallback: string }) {
  return (
    <div className="surface-inset p-4">
      <p className="metadata-text">{label}</p>
      <p className={`mt-1 font-jakarta text-sm leading-relaxed ${value ? "text-gray-800" : "text-gray-400"}`}>
        {value || fallback}
      </p>
    </div>
  );
}

function EmptyPanel({ title, description, href, action }: { title: string; description: string; href: string; action: string }) {
  return (
    <div className="rounded-lg border border-dashed border-black/12 bg-[#f8f6f0] p-5">
      <p className="font-bricolage text-sm font-bold text-gray-900">{title}</p>
      <p className="mt-2 font-jakarta text-sm leading-relaxed text-gray-500">{description}</p>
      <Link href={href} className="mt-4 inline-flex items-center gap-1.5 font-bricolage text-xs font-bold text-emerald-700 hover:text-emerald-800">
        {action} <ArrowRight size={12} />
      </Link>
    </div>
  );
}
