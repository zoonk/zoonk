import postsData from "@/app/posts.json";

type Post = { id: string; date: string; title: string; authorId: string };

export function getPostsByYear(): Map<string, Post[]> {
  const grouped = new Map<string, Post[]>();

  for (const post of postsData) {
    const year = post.id.split("/")[0] ?? "";
    const existing = grouped.get(year) ?? [];
    grouped.set(year, [...existing, post]);
  }

  return grouped;
}

export function formatDateWithoutYear(date: string): string {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long" }).format(new Date(date));
}
