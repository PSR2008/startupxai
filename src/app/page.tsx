import type { Metadata } from "next";
import { Landing } from "@/components/launchgate/landing";
import "@/components/launchgate/launchgate.css";
export const metadata: Metadata = { icons: { icon: "/launchgate-icon.svg" }, authors: [{ name: "LaunchGate" }], creator: "LaunchGate", publisher: "LaunchGate", keywords: ["release assurance", "business invariants", "release gates"], title: { absolute: "LaunchGate — Prove it can ship" }, description: "Your AI says it works. LaunchGate proves it can ship. Verify business invariants, reproduce failures and gate releases with evidence.", alternates: { canonical: "/" }, openGraph: { url: "/", title: "LaunchGate — Prove it can ship", description: "Release assurance for AI-built software.", siteName: "LaunchGate", images: [] }, twitter: { title: "LaunchGate — Prove it can ship", description: "Release assurance for AI-built software.", images: [] } };
export default function Page() { return <Landing />; }
