import { BLOG_URL } from "@zoonk/utils/url";
import { type MetadataRoute } from "next";
import posts from "./posts.json";

export default function sitemap(): MetadataRoute.Sitemap {
  const postEntries = posts.map((post) => ({
    url: `${BLOG_URL}/${post.id}`,
  }));

  return [{ url: BLOG_URL }, ...postEntries];
}
