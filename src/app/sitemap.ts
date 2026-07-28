import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/pricing", "/methodology", "/support", "/privacy"];

  return routes.map((route) => ({
    url: canonicalUrl(route),
    lastModified: new Date("2026-05-27"),
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
