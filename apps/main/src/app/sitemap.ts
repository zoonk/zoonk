import { SITE_URL } from "@zoonk/utils/constants";
import { type MetadataRoute } from "next";

const STATIC_PATHS = ["/", "/courses", "/learn", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return STATIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
  }));
}
