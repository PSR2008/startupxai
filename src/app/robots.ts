import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/profile", "/reports", "/share", "/onboarding", "/internal", "/payment"],
    },
    sitemap: canonicalUrl("/sitemap.xml"),
  };
}
