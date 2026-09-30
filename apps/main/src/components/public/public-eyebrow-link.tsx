import { type getCourseHref } from "@/data/courses/course-href";
import { Link } from "@/i18n/navigation";
import { type getChapterHref } from "@/lib/public/public-hrefs";
import { type ReactNode } from "react";

/**
 * Where a chapter or lesson page belongs, as a quiet link over its title: context for visitors
 * from a search result, without a breadcrumb trail.
 */
export function PublicEyebrowLink({
  children,
  href,
}: {
  children: ReactNode;
  href: ReturnType<typeof getChapterHref> | ReturnType<typeof getCourseHref>;
}) {
  return (
    <Link
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -my-2.5 inline-flex min-h-11 max-w-full items-center rounded-md text-sm leading-snug font-medium text-pretty transition-colors outline-none focus-visible:ring-[3px] sm:text-[15px]"
      href={href}
    >
      {children}
    </Link>
  );
}
