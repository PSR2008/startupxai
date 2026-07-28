import type { Metadata } from "next";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import HeroSection from "@/components/marketing/HeroSection";
import {
  CapabilitiesSection,
  DifferentiationSection,
  EvidenceEntrySection,
  LogoMarquee,
  EnginesSection,
  FeaturesSection,
  RealWorkflowSection,
  RecurringEvidenceSection,
  HowItWorksSection,
  ComparisonSection,
  TrustSection,
  TestimonialsSection,
  PricingSection,
  CTASection,
} from "@/components/marketing/EnginesSection";

export const metadata: Metadata = {
  title: "StartupX AI - Founder Intelligence Workspace",
  description:
    "Assess assumptions, collect evidence, track experiments, and decide what to build next with a structured founder workspace.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    url: "/",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <RealWorkflowSection />
      <EvidenceEntrySection />
      <LogoMarquee />
      <EnginesSection />
      <FeaturesSection />
      <DifferentiationSection />
      <RecurringEvidenceSection />
      <HowItWorksSection />
      <CapabilitiesSection />
      <ComparisonSection />
      <TrustSection />
      <TestimonialsSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </div>
  );
}
