import Link from "next/link";
import { Zap, Twitter, Linkedin, Github } from "lucide-react";

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

const socialLinks = [
  { Icon: Twitter, href: "#", label: "Twitter" },
  { Icon: Linkedin, href: "#", label: "LinkedIn" },
  { Icon: Github, href: "#", label: "GitHub" },
];

type FooterProps = {
  variant?: "default" | "homepage";
};

export default function Footer({ variant = "default" }: FooterProps) {
  const isHomepage = variant === "homepage";

  return (
    <footer
      className={
        isHomepage
          ? "homepage-footer border-t border-white/[0.12] bg-slate-950/[0.76]"
          : "border-t border-black/8 bg-[#fffefa]"
      }
    >
      <div className={isHomepage ? "container-custom pt-[52px] pb-[22px]" : "container-custom py-16"}>
        <div
          className={
            isHomepage
              ? "grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-[1.35fr_0.8fr_0.8fr_0.78fr_0.78fr] lg:gap-x-10 mb-9"
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
              <span className={isHomepage ? "font-bricolage text-base font-bold text-white" : "font-bricolage text-base font-bold text-gray-900"}>
                StartupX <span className={isHomepage ? "text-emerald-300" : "text-gradient-brand"}>AI</span>
              </span>
            </Link>
            <p
              className={
                isHomepage
                  ? "font-jakarta text-sm text-slate-300/[0.78] leading-relaxed max-w-56 mb-4"
                  : "font-jakarta text-sm text-gray-500 leading-relaxed max-w-48 mb-5"
              }
            >
              Evidence-backed assessment workflows for early founder decisions.
            </p>
            <div className="flex gap-2">
              {socialLinks.map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={`StartupX AI on ${label}`}
                  className={
                    isHomepage
                      ? "w-8 h-8 rounded-lg border border-white/[0.12] bg-white/[0.06] flex items-center justify-center text-slate-300/[0.78] hover:text-white hover:border-emerald-300/[0.35] hover:bg-white/10 transition-all"
                      : "w-8 h-8 rounded-lg border border-black/8 bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-black/14 hover:bg-gray-100 transition-all"
                  }
                >
                  <Icon size={14} />
                </a>
              ))}
            </div>
          </div>

          {Object.entries(footerLinks).map(([section, links]) => (
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
              <ul className={isHomepage ? "space-y-2" : "space-y-2.5"}>
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={
                        isHomepage
                          ? "font-jakarta text-sm text-slate-300/70 hover:text-white transition-colors"
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
              ? "border-t border-white/10 pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              : "border-t border-black/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          }
        >
          <p className={isHomepage ? "font-jakarta text-xs text-slate-400" : "font-jakarta text-xs text-gray-400"}>
            © {new Date().getFullYear()} StartupX AI. All rights reserved.
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
