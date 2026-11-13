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