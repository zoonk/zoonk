import { SITE_URL } from "@zoonk/utils/constants";
import { type MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: "/",
      disallow: [
        "/auth/",
        "/generate/",
        "/login",
        "/my",
        "/energy",
        "/level",
        "/score",
        "/support",
        "/language",
        "/profile",
        "/subscription",
        "/p/",
      ],
      userAgent: "*",
    },
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      `${SITE_URL}/sitemap-courses/sitemap/0.xml`,
      `${SITE_URL}/sitemap-chapters/sitemap/0.xml`,
      `${SITE_URL}/sitemap-lessons/sitemap/0.xml`,
    ],
  };
}
