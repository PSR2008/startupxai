import type { Metadata } from "next";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import Galaxy from "@/components/marketing/Galaxy";
import HeroSection from "@/components/marketing/HeroSection";
import ProductScrollStackSection from "@/components/marketing/ProductScrollStackSection";
import {
  CapabilitiesSection,
  DifferentiationSection,
  EvidenceEntrySection,
  LogoMarquee,
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
      <div className="homepage-galaxy-stage">
        <Galaxy
          className="homepage-galaxy-canvas"
          focal={[0.5, 0.18]}
          rotation={[0.92, 0.18]}
          starSpeed={0.42}
          density={1.34}
          hueShift={174}
          glowIntensity={0.36}
          saturation={0.34}
          twinkleIntensity={0.24}
          rotationSpeed={0.045}
          repulsionStrength={1.35}
          autoCenterRepulsion={0.08}
          transparent={false}
        />
        <div className="homepage-galaxy-content">
          <ProductScrollStackSection />
          <RealWorkflowSection />
          <EvidenceEntrySection />
          <LogoMarquee />
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
      </div>
    </div>
  );
}
