import type { Metadata } from "next";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import HeroSection from "@/components/marketing/HeroSection";
import {
  LogoMarquee,
  EnginesSection,
  FeaturesSection,
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
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fc] overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <LogoMarquee />
      <EnginesSection />
      <FeaturesSection />
      <HowItWorksSection />
      <ComparisonSection />
      <TrustSection />
      <TestimonialsSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </div>
  );
}
