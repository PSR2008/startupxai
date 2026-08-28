import type { Metadata } from "next";
import WaitlistyHomepage from "@/components/marketing/waitlisty";

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
  return <WaitlistyHomepage />;
}
