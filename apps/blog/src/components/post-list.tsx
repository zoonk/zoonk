import { getPostsByYear } from "@/lib/posts";
import Link from "next/link";

/**
 * Chronological list of blog posts grouped by year.
 * Displayed on the home page with minimal styling:
 * year label on the left, post title as link, date on the right.
 */
export function PostList() {
  const postsByYear = getPostsByYear();

  return (
    <ul className="text-sm">
      {[...postsByYear.entries()].map(([year, posts]) => (
        <li key={year}>
          {posts.map((post, index) => {
            const href = `/${post.id}`;
            const isFirstOfYear = index === 0;

            return (
              <Link key={post.id} href={href} className="group flex items-baseline py-2">
                <span className="text-muted-foreground w-14 shrink-0 text-xs">
                  {isFirstOfYear ? year : ""}
                </span>

                <span className="grow">
                  <span className="group-hover:bg-muted rounded-lg px-1.5 py-0.5 transition-colors">
                    {post.title}
                  </span>
                </span>

                <span className="text-muted-foreground shrink-0 text-xs">{post.date}</span>
              </Link>
            );
          })}
        </li>
      ))}
    </ul>
  );
}
