import { type LibraryChapterRoute } from "@/data/catalog/resolve-catalog-route";
import { Link } from "@/i18n/navigation";
import { getLessonHref } from "@/lib/public/public-hrefs";
import { getMinutesFormatter } from "@/lib/public/public-labels";
import { CURRENT_ROW_CLASS, LIST_ROW_INTERACTIVE_CLASS } from "@zoonk/learn/list";
import { ROUTE_CLASS, ROUTE_ROWS_CLASS, RouteMark } from "@zoonk/learn/route-line";
import { cn } from "@zoonk/ui/lib/utils";

const ROW_CLASS = cn(LIST_ROW_INTERACTIVE_CLASS, "items-start py-3");

const STATION_CLASS = "top-[1.375rem]";

/** A station sits on its row's band, so its hollow takes the band's color. */
const ITEM_CLASS = cn(
  "relative overflow-y-clip",
  "has-[>a:hover:not([aria-current])]:[--route-fill:color-mix(in_srgb,var(--muted)_70%,var(--background))] has-[>a[aria-current]]:[--route-fill:var(--muted)]",
);

export async function ChapterLessonRows({
  chapter,
  className,
  currentLessonId,
  params,
}: {
  chapter: LibraryChapterRoute["chapter"];
  className?: string;
  currentLessonId?: string;
  params: { brandSlug: string; courseSlug: string };
}) {
  const formatMinutes = await getMinutesFormatter();
  const last = chapter.lessons.length - 1;

  return (
    <ol
      className={cn(ROUTE_CLASS, ROUTE_ROWS_CLASS, "flex flex-col ps-(--route-inset)", className)}
    >
      {chapter.lessons.map((lesson, index) => {
        const isCurrent = lesson.id === currentLessonId;

        return (
          <li className={ITEM_CLASS} key={lesson.id}>
            <RouteMark
              className={STATION_CLASS}
              down={index < last}
              station={isCurrent ? "page" : "stop"}
              up={index > 0}
            />

            <Link
              aria-current={isCurrent ? "page" : undefined}
              className={cn(ROW_CLASS, isCurrent && CURRENT_ROW_CLASS)}
              href={getLessonHref({
                ...params,
                chapterSlug: chapter.slug,
                lessonSlug: lesson.slug,
              })}
              prefetch
            >
              <span className="text-faint w-4 shrink-0 font-mono text-xs leading-5 tabular-nums">
                {index + 1}
              </span>

              <span className="min-w-0 flex-1 text-sm leading-5 font-medium text-pretty">
                {lesson.title}
              </span>

              <span className="text-muted-foreground shrink-0 font-mono text-xs leading-5 whitespace-nowrap tabular-nums">
                {formatMinutes(lesson.estimatedMinutes)}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
