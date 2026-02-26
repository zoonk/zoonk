import { SITE_URL } from "@zoonk/utils/constants";
import { type MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: "/",
      disallow: ["/auth/", "/generate/", "/login", "/p/"],
      userAgent: "*",
    },
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      `${SITE_URL}/sitemaps/courses/sitemap/0.xml`,
      `${SITE_URL}/sitemaps/chapters/sitemap/0.xml`,
      `${SITE_URL}/sitemaps/lessons/sitemap/0.xml`,
    ],
  };
}
