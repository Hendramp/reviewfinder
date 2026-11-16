const stopwords = new Set(["the", "hotel", "motel", "inn", "suites", "resort", "llc", "inc", "and", "of", "at", "by", "a"]);

export function distinctiveTokens(name: string): string[] {
  return [...new Set(name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token && !stopwords.has(token)))];
}

export function nameSimilarity(a: string, b: string): number {
  const first = new Set(distinctiveTokens(a));
  const second = new Set(distinctiveTokens(b));
  const union = new Set([...first, ...second]);
  if (!union.size) return 0;
  const intersectionSize = [...first].filter((token) => second.has(token)).length;
  return intersectionSize / union.size;
}

export function normalized(input: string): string {
  return distinctiveTokens(input).join(" ");
}

export function canonicalKey(name: string, address: string): string {
  const stripPhone = (value: string) => value.replace(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, " ");
  return `${normalized(stripPhone(name))}|${normalized(stripPhone(address))}`;
}

export function normalizeAddress(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function listingUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function listingPlatform(input: string): string {
  try {
    const domain = new URL(input).hostname.toLowerCase().replace(/^www\./, "");
    if (domain === "airbnb.com" || domain.endsWith(".airbnb.com")) return "Airbnb";
    if (domain === "vrbo.com" || domain.endsWith(".vrbo.com")) return "Vrbo";
    if (domain === "furnishedfinder.com" || domain.endsWith(".furnishedfinder.com")) return "Furnished Finder";
    return domain || "Stay";
  } catch {
    return "Stay";
  }
}