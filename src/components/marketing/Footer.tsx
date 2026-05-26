import Link from "next/link";
import { Zap, Twitter, Linkedin, Github } from "lucide-react";

const footerLinks = {
  Product: [
    { label: "Idea Engine", href: "/idea-engine" },
    { label: "Competitor Intelligence", href: "/competitor-intelligence" },
    { label: "Revenue Engine", href: "/revenue-engine" },
    { label: "User Psychology", href: "/user-psychology" },
    { label: "Growth Engine", href: "/growth-engine" },
    { label: "Founder Decision", href: "/founder-decision" },
  ],
  Tools: [
    { label: "ColdDM AI", href: "/cold-dm" },
    { label: "BrandForge AI", href: "/brand-forge" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Pricing", href: "/pricing" },
  ],
  Company: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Support", href: "/support" },
    { label: "Contact Us", href: "/support#contact" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-black/6 bg-white">
      <div className="container-custom py-16">
        {/* Top */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
                <Zap size={14} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bricolage text-base font-bold text-gray-900">
                StartupX <span className="text-gradient-brand">AI</span>
              </span>
            </Link>
            <p className="font-jakarta text-sm text-gray-500 leading-relaxed max-w-48 mb-5">
              The founder intelligence platform. Build smarter, ship faster.
            </p>
            <div className="flex gap-2">
              {[
                { Icon: Twitter, href: "#" },
                { Icon: Linkedin, href: "#" },
                { Icon: Github, href: "#" },
              ].map(({ Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
                  className="w-8 h-8 rounded-lg border border-black/8 bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-black/14 hover:bg-gray-100 transition-all"
                >
                  <Icon size={14} />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <p className="font-bricolage text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">
                {section}
              </p>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="font-jakarta text-sm text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="border-t border-black/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-jakarta text-xs text-gray-400">
            © {new Date().getFullYear()} StartupX AI. All rights reserved.
          </p>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-200 bg-emerald-50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-jakarta text-xs font-semibold text-emerald-700">
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
