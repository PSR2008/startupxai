import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import { Toaster } from "react-hot-toast";
import AuthFragmentGuard from "@/components/auth/AuthFragmentGuard";
import { SEO_BASE_URL } from "@/lib/seo";
import "./globals.css";

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
});

const displayFont = Newsreader({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SEO_BASE_URL),
  title: {
    default: "StartupX AI - Founder Intelligence Workspace",
    template: "%s | StartupX AI",
  },
  description:
    "StartupX AI helps founders assess assumptions, review evidence, analyze competitors, pressure-test pricing, and turn growth questions into structured next validation actions.",
  keywords: [
    "startup evidence assessment",
    "founder evidence workspace",
    "market assumption assessment",
    "startup experiment tracking",
    "competitor intelligence",
    "revenue strategy",
    "growth experiments",
    "founder tools",
    "startup SaaS",
    "idea assessment",
    "startup growth",
    "business evidence platform",
    "cold outreach generator",
    "brand naming",
    "startup platform",
  ],
  authors: [{ name: "StartupX AI" }],
  creator: "StartupX AI",
  publisher: "StartupX AI",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SEO_BASE_URL,
    siteName: "StartupX AI",
    title: "StartupX AI - Founder Intelligence Workspace",
    description:
      "Evidence-backed assessment workflows for founders reviewing market assumptions, competitors, pricing, user trust, and growth strategy.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "StartupX AI" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "StartupX AI - Founder Intelligence Workspace",
    description: "Assess assumptions, map competitors, pressure-test pricing, and turn growth questions into structured next validation actions.",
    creator: "@startupxai",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#f7f8fc",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`} suppressHydrationWarning>
        <AuthFragmentGuard />
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#ffffff",
              color: "#0f1117",
              border: "1px solid rgba(0,0,0,0.08)",
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              borderRadius: "12px",
              padding: "12px 16px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
            },
            success: {
              iconTheme: { primary: "#10b981", secondary: "#ffffff" },
            },
            error: {
              iconTheme: { primary: "#f43f5e", secondary: "#ffffff" },
            },
          }}
        />
      </body>
    </html>
  );
}
