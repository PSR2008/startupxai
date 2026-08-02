import Link from "next/link";
import { Zap } from "lucide-react";

const footerLinks = {
  Product: [
    { label: "Evidence Engine", href: "/evidence-engine" },
    { label: "Idea Engine", href: "/idea-engine" },
    { label: "Competitor Intelligence", href: "/competitor-intelligence" },
    { label: "Revenue Engine", href: "/revenue-engine" },
    { label: "User Psychology", href: "/user-psychology" },
    { label: "Growth Engine", href: "/growth-engine" },
    { label: "Founder Decision", href: "/founder-decision" },
  ],
  Tools: [
    { label: "ColdDM", href: "/cold-dm" },
    { label: "BrandForge", href: "/brand-forge" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Pricing", href: "/pricing" },
  ],
  Company: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Support", href: "/support" },
    { label: "Contact Us", href: "/support#contact" },
  ],
  Account: [
    { label: "Create account", href: "/signup" },
    { label: "Sign in", href: "/signin" },
    { label: "Dashboard", href: "/dashboard" },
  ],
};

const homepageFooterLinks = {
  Workspace: [
    { label: "Evidence Engine", href: "/evidence-engine" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Reports", href: "/reports" },
    { label: "Pricing", href: "/pricing" },
  ],
  Assessments: [
    { label: "Idea & Market", href: "/idea-engine" },
    { label: "Competitor Intelligence", href: "/competitor-intelligence" },
    { label: "Revenue Engine", href: "/revenue-engine" },
    { label: "Growth Engine", href: "/growth-engine" },
    { label: "Founder Decision", href: "/founder-decision" },
  ],
  Tools: [
    { label: "User Psychology", href: "/user-psychology" },
    { label: "ColdDM", href: "/cold-dm" },
    { label: "BrandForge", href: "/brand-forge" },
    { label: "Create account", href: "/signup" },
  ],
  Company: [
    { label: "Privacy", href: "/privacy" },
    { label: "Support", href: "/support" },
    { label: "Contact", href: "/support#contact" },
    { label: "Sign in", href: "/signin" },
  ],
};

type FooterProps = {
  variant?: "default" | "homepage";
};

export default function Footer({ variant = "default" }: FooterProps) {
  const isHomepage = variant === "homepage";
  const linkGroups = isHomepage ? homepageFooterLinks : footerLinks;

  return (
    <footer
      className={
        isHomepage
          ? "homepage-footer border-t border-white/[0.12] bg-slate-950/[0.76]"
          : "border-t border-black/8 bg-[#fffefa]"
      }
    >
      <div className={isHomepage ? "container-custom pt-7 pb-7" : "container-custom py-16"}>
        <div
          className={
            isHomepage
              ? "grid grid-cols-2 gap-x-6 gap-y-7 md:grid-cols-[1.15fr_repeat(4,minmax(0,0.72fr))] lg:gap-x-8 mb-6"
              : "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 mb-14"
          }
        >
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className={isHomepage ? "flex items-center gap-2.5 mb-3" : "flex items-center gap-2.5 mb-4"}>
              <div
                className={
                  isHomepage
                    ? "w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/20"
                    : "w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/20"
                }
              >
                <Zap size={14} className="text-white" strokeWidth={2.5} />
              </div>
              <span className={isHomepage ? "font-jakarta text-base font-bold text-white" : "font-jakarta text-base font-bold text-gray-900"}>
                StartupX <span className={isHomepage ? "text-emerald-300" : "text-gradient-brand"}>AI</span>
              </span>
            </Link>
            <p
              className={
                isHomepage
                  ? "font-jakarta text-sm text-slate-300/[0.78] leading-relaxed max-w-64 mb-3"
                  : "font-jakarta text-sm text-gray-500 leading-relaxed max-w-48 mb-5"
              }
            >
              Evidence-backed assessment workflows for founder decisions.
            </p>
          </div>

          {Object.entries(linkGroups).map(([section, links]) => (
            <div key={section}>
              <p
                className={
                  isHomepage
                    ? "mb-3 font-jakarta text-xs font-semibold text-white/[0.88]"
                    : "mb-4 font-jakarta text-xs font-semibold text-gray-700"
                }
              >
                {section}
              </p>
              <ul className={isHomepage ? "space-y-1.5" : "space-y-2.5"}>
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={
                        isHomepage
                          ? "font-jakarta text-[0.83rem] leading-5 text-slate-300/70 hover:text-white transition-colors"
                          : "font-jakarta text-sm text-gray-500 hover:text-gray-900 transition-colors"
                      }
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className={
            isHomepage
              ? "border-t border-white/12 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              : "border-t border-black/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          }
        >
          <p className={isHomepage ? "font-jakarta text-xs text-slate-400" : "font-jakarta text-xs text-gray-400"}>
            &copy; {new Date().getFullYear()} StartupX AI. All rights reserved.
          </p>
          <div
            className={
              isHomepage
                ? "flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/[0.08]"
                : "flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-200 bg-emerald-50"
            }
          >
            <span
              className={
                isHomepage
                  ? "w-1.5 h-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.45)]"
                  : "w-1.5 h-1.5 rounded-full bg-emerald-500"
              }
            />
            <span
              className={
                isHomepage
                  ? "font-jakarta text-xs font-semibold text-emerald-100/90"
                  : "font-jakarta text-xs font-semibold text-emerald-700"
              }
            >
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
