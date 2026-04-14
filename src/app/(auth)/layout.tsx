import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "StartupX AI — Sign In",
    template: "%s | StartupX AI",
  },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f8fc] flex flex-col">
      {/* Subtle mesh background */}
      <div className="fixed inset-0 pointer-events-none hero-mesh opacity-60" />
      <div className="fixed inset-0 pointer-events-none dot-pattern opacity-30" />
      {children}
    </div>
  );
}
