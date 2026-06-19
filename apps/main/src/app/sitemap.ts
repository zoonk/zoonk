import { SITE_URL } from "@zoonk/utils/url";
import { type MetadataRoute } from "next";

const STATIC_PATHS = [
  "/",
  "/start",
  "/start/speak",
  "/start/learn",
  "/start/exam",
  "/privacy",
  "/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return STATIC_PATHS.map((path) => ({ url: `${SITE_URL}${path}` }));
}
