import postsData from "@/app/posts.json";

type Post = {
  id: string;
  date: string;
  title: string;
  authorId: string;
};

/**
 * Group posts by year for the home page listing.
 * Extracts the year from the post ID (e.g., "2026/hello-world" -> "2026").
 */
export function getPostsByYear(): Map<string, Post[]> {
  const grouped = new Map<string, Post[]>();

  for (const post of postsData) {
    const year = post.id.split("/")[0] ?? "";
    const existing = grouped.get(year) ?? [];
    grouped.set(year, [...existing, post]);
  }

  return grouped;
}
