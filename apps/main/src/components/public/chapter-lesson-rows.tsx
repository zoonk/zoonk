import { type LibraryChapterRoute } from "@/data/catalog/resolve-catalog-route";
import { Link } from "@/i18n/navigation";
import { getLessonHref } from "@/lib/public/public-hrefs";
import { getMinutesFormatter } from "@/lib/public/public-labels";
import { ROUTE_CLASS, RouteMark } from "@zoonk/learn/route-line";
import { cn } from "@zoonk/ui/lib/utils";

const ROW_CLASS =
  "relative isolate flex items-start gap-3 py-3 pl-(--route-inset) outline-none before:pointer-events-none before:absolute before:inset-y-0.5 before:right-[-0.625rem] before:left-[calc(var(--route-inset)-0.625rem)] before:-z-10 before:rounded-[0.625rem] before:transition-colors hover:before:bg-muted/70 focus-visible:before:ring-[3px] focus-visible:before:ring-ring/50";

const CURRENT_ROW_CLASS = "before:bg-muted hover:before:bg-muted";

const STATION_CLASS = "top-[1.375rem] left-(--route-x)";

export async function ChapterLessonRows({
  chapter,
  currentLessonId,
  params,
}: {
  chapter: LibraryChapterRoute["chapter"];
  currentLessonId?: string;
  params: { brandSlug: string; courseSlug: string };
}) {
  const formatMinutes = await getMinutesFormatter();
  const last = chapter.lessons.length - 1;

  return (
    <ol className={cn(ROUTE_CLASS, "flex flex-col")}>
      {chapter.lessons.map((lesson, index) => {
        const isCurrent = lesson.id === currentLessonId;

        return (
          <li className="relative overflow-y-clip" key={lesson.id}>
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
