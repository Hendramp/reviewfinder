import type { SubjectKind } from "@/lib/types";

export function normalizeAirbnbUrl(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  try {
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    let url = new URL(value);
    if (url.hostname.toLowerCase() === "abnb.me") {
      const target = url.searchParams.get("url") ?? url.searchParams.get("redirect");
      if (target) {
        try { url = new URL(target); } catch { return null; }
      } else if (url.pathname.match(/\/rooms\/(\d+)/i)) {
        const match = url.pathname.match(/\/rooms\/(\d+)/i);
        return match ? `airbnb.com/rooms/${match[1]}` : null;
      } else {
        return null;
      }
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "airbnb.com" && !host.endsWith(".airbnb.com")) return null;
    const match = url.pathname.match(/\/rooms\/(\d+)/i);
    return match ? `airbnb.com/rooms/${match[1]}` : null;
  } catch {
    return null;
  }
}

export function normalizeAddress(input: string): string {
  return input
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\b(?:suite|apt|apartment|unit)\b\s*[a-z0-9-]*/g, " ")
    .replace(/\bst\b/g, "street")
    .replace(/\bave\b/g, "avenue")
    .replace(/\bblvd\b/g, "boulevard")
    .replace(/\brd\b/g, "road")
    .replace(/\bdr\b/g, "drive")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalKey(kind: SubjectKind, name: string, address: string): string | null {
  if (kind === "stay") return normalizeAirbnbUrl(name);
  const normalizedName = normalizeAddress(name);
  const normalizedAddress = normalizeAddress(address);
  return normalizedName && normalizedAddress ? `${normalizedName}|${normalizedAddress}` : null;
}