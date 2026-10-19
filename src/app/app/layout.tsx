import type { Metadata } from "next";
import "@/components/launchgate/launchgate.css";
export const metadata: Metadata = { title: { default: "LaunchGate", template: "%s | LaunchGate" }, description: "Release assurance for the business invariants that matter.", icons: { icon: "/launchgate-icon.svg" }, robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return <div className="lg">{children}</div>; }
