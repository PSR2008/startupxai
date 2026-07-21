import dns from "dns/promises";
import net from "net";

const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal"]);

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

function isPrivateIpv6(ip: string): boolean {
  const value = ip.toLowerCase();
  return value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:");
}

export function normalizeHttpUrl(value?: string | null): URL | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

export async function assertPublicHttpUrl(value?: string | null): Promise<URL | null> {
  const url = normalizeHttpUrl(value);
  if (!url) return null;

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".local")) return null;

  const literalType = net.isIP(hostname);
  if (literalType === 4 && isPrivateIpv4(hostname)) return null;
  if (literalType === 6 && isPrivateIpv6(hostname)) return null;

  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) return null;
    const unsafe = records.some((record) => {
      if (record.family === 4) return isPrivateIpv4(record.address);
      if (record.family === 6) return isPrivateIpv6(record.address);
      return true;
    });
    return unsafe ? null : url;
  } catch {
    return null;
  }
}
