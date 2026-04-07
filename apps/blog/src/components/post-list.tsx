import { formatDateWithoutYear, getPostsByYear } from "@/lib/posts";
import Link from "next/link";

/**
 * Chronological list of blog posts grouped by year.
 * Each year appears as a section header above its posts.
 * Post rows show the title and a short date (without the year,
 * since the section header already provides that context).
 */
export function PostList() {
  const postsByYear = getPostsByYear();
  const yearGroups = [...postsByYear.entries()];

  return (
    <ul>
      {yearGroups.map(([year, posts], groupIndex) => (
        <li key={year} className={groupIndex > 0 ? "mt-10" : ""}>
          <h2 className="text-muted-foreground mb-3 text-sm font-medium">{year}</h2>

          <ul>
            {posts.map((post) => {
              const href = `/${post.id}` as const;

              return (
                <li key={post.id}>
                  <Link href={href} className="group flex items-baseline py-2 text-sm">
                    <span className="group-hover:bg-muted -mx-1.5 grow rounded-lg px-1.5 py-0.5 transition-colors">
                      {post.title}
                    </span>

                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatDateWithoutYear(post.date)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
