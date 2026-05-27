import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-jakarta",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://startupxai.in"),
  title: {
    default: "StartupX AI - Your AI Co-Founder for Market, Product & Growth",
    template: "%s | StartupX AI",
  },
  description:
    "StartupX AI is the founder operating system powered by AI. Validate ideas, analyze competitors, unlock revenue strategies, decode user psychology, and accelerate growth - all in one intelligent platform.",
  keywords: [
    "startup AI",
    "AI co-founder",
    "market analysis AI",
    "startup validation",
    "competitor intelligence",
    "revenue strategy AI",
    "growth hacking AI",
    "founder tools",
    "startup SaaS",
    "idea validation",
    "startup growth",
    "business intelligence AI",
    "cold outreach generator",
    "brand naming AI",
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
    url: "https://startupxai.in",
    siteName: "StartupX AI",
    title: "StartupX AI - Your AI Co-Founder for Market, Product & Growth",
    description:
      "The founder intelligence platform that analyzes your market, competitors, revenue model, user psychology, and growth strategy - in minutes.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "StartupX AI" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "StartupX AI - Your AI Co-Founder",
    description: "Validate ideas. Crush competitors. Unlock revenue. Decode user psychology. Accelerate growth.",
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
      <body className={`${jakarta.variable} ${bricolage.variable} ${jetbrains.variable}`} suppressHydrationWarning>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#ffffff",
              color: "#0f1117",
              border: "1px solid rgba(0,0,0,0.08)",
              fontFamily: "var(--font-jakarta)",
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
