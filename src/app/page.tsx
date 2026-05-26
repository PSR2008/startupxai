import type { Metadata } from "next";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import HeroSection from "@/components/marketing/HeroSection";
import { LogoMarquee, EnginesSection, FeaturesSection, TestimonialsSection, PricingSection, CTASection } from "@/components/marketing/EnginesSection";

export const metadata: Metadata = {
  title: "StartupX AI — Your AI Co-Founder for Market, Product & Growth",
  description:
    "The all-in-one AI platform that validates your startup idea, maps competitors, unlocks revenue strategies, decodes user psychology, and accelerates growth. Built for serious founders.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fc] overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <LogoMarquee />
      <EnginesSection />
      <FeaturesSection />
      <TestimonialsSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </div>
  );
}
