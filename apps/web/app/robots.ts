import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APPFORGE_PUBLIC_URL ?? "http://localhost:3000";
  // Account, editor and share-link pages are private or transient: keep them out of search results.
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/*/studio/", "/*/apps/", "/*/dashboard", "/*/preview/", "/*/pay/"] }, sitemap: `${base}/sitemap.xml` };
}
