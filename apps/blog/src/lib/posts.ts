import postsData from "@/app/posts.json";
import { formatIsoDate } from "@zoonk/utils/date-format";

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

/** A post's day as the app writes a date in a row: "Nov 12", or "Nov 12, 2026" with its year. */
export function formatPostDate({ isoDate, year }: { isoDate: string; year: "always" | "never" }) {
  return formatIsoDate({ isoDate, locale: "en", role: "row", today: isoDate, year });
}
