import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://startupxai.in";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/pricing", "/support", "/privacy", "/signin", "/signup"];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date("2026-05-27"),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
