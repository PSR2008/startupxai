export const SEO_BASE_URL = "https://www.startupxai.in";

export function canonicalUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, SEO_BASE_URL).toString();
}
