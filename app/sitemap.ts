import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const baseUrl = new URL(siteUrl);
  return [
    "/",
    "/browse?category=stays",
    "/browse?category=hotels",
    "/browse?category=leases",
  ].map((path) => ({ url: new URL(path, baseUrl).toString() }));
}
