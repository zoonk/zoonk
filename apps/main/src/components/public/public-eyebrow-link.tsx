import { type getCourseHref } from "@/data/courses/course-href";
import { Link } from "@/i18n/navigation";
import { type getChapterHref } from "@/lib/public/public-hrefs";
import { type ReactNode } from "react";

export function PublicEyebrowLink({
  children,
  href,
}: {
  children: ReactNode;
  href: ReturnType<typeof getChapterHref> | ReturnType<typeof getCourseHref>;
}) {
  return (
    <Link
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 sm:text-reading hit-area relative max-w-full rounded-md text-sm leading-snug font-medium text-pretty transition-colors outline-none focus-visible:ring-[3px]"
      href={href}
      prefetch
    >
      {children}
    </Link>
  );
}
