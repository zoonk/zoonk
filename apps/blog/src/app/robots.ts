import { BLOG_URL } from "@zoonk/utils/url";
import { type MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: "/",
      userAgent: "*",
    },
    sitemap: `${BLOG_URL}/sitemap.xml`,
  };
}
