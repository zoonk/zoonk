import { ShowMore } from "@/components/catalog/show-more";
import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { type LibraryOutline } from "@/data/catalog/resolve-catalog-route";
import { Link } from "@/i18n/navigation";
import { getChapterHref, getLessonHref } from "@/lib/public/public-hrefs";
import { RouteMark } from "@zoonk/learn/route-line";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { Fragment, type ReactNode } from "react";

export type OutlineParams = { brandSlug: string; courseSlug: string };
export type OutlineBand = LibraryOutline["levels"][number];
export type OutlineChapter = OutlineBand["chapters"][number];

/** A no-break space keeps each dot at the end of a line, never at the start of the next. */
export const OUTLINE_SEPARATOR = " · ";

const CHAPTERS_SHOWN = 6;

/** A fold that hides two chapters saves nothing. */
const CHAPTERS_FOLDED_FROM = CHAPTERS_SHOWN + 3;

/*
 * Targets stay inside the row, never overlap and are at least 44px each way: the title reaches
 * through the row's padding (`py-4`, `mt-1.5`), and a lone lesson through its row's bottom (`pb-5.5`).
 */
const ROW_CLASS = "relative flex gap-4 py-4";
const LONE_LESSON_ROW_CLASS = "pb-5.5";
const ROW_STATION_CLASS = "top-[1.6875rem]";

const CHAPTER_LINK_CLASS =
  "focus-visible:ring-ring/50 relative inline-block rounded-md outline-none before:absolute before:inset-x-0 before:-top-4 before:-bottom-1.5 before:min-w-11 hover:underline hover:underline-offset-4 focus-visible:ring-[3px]";

const LESSON_LINK_CLASS =
  "hover:text-foreground focus-visible:ring-ring/50 rounded-sm outline-none hover:underline hover:underline-offset-4 focus-visible:ring-[3px]";

const LONE_LESSON_LINK_CLASS =
  "relative inline-block before:absolute before:inset-x-0 before:top-0 before:-bottom-5.5 before:min-w-11";

const MARK_CLASS = cn(NUMERIC_CLASS, "text-muted-foreground flex-none text-xs leading-5.5");

function ChapterLessonLinks({
  chapter,
  params,
}: {
  chapter: OutlineChapter;
  params: OutlineParams;
}) {
  const hasLoneLesson = chapter.lessons.length === 1;

  return (
    <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
      {chapter.lessons.map((lesson, index) => (
        <Fragment key={lesson.id}>
          {index > 0 && OUTLINE_SEPARATOR}
          <Link
            className={cn(LESSON_LINK_CLASS, hasLoneLesson && LONE_LESSON_LINK_CLASS)}
            href={getLessonHref({ ...params, chapterSlug: chapter.slug, lessonSlug: lesson.slug })}
            prefetch
          >
            {lesson.title}
          </Link>
        </Fragment>
      ))}
    </p>
  );
}

/** Every row stays in the page's HTML, for search engines. */
export async function OutlineChapterList({ rows }: { rows: ReactNode[] }) {
  const t = await getExtracted();

  if (rows.length < CHAPTERS_FOLDED_FROM) {
    return <ol>{rows}</ol>;
  }

  const rest = rows.length - CHAPTERS_SHOWN;

  return (
    <div className="flex flex-col">
      <ol>{rows.slice(0, CHAPTERS_SHOWN)}</ol>

      <ShowMore
        className="mt-1 ml-10"
        less={t("Show fewer chapters")}
        more={t("{count, plural, one {Show # more chapter} other {Show # more chapters}}", {
          count: rest,
        })}
      >
        <ol>{rows.slice(CHAPTERS_SHOWN)}</ol>
      </ShowMore>
    </div>
  );
}

/** Its title is a heading under the section's: a level's or an area's name is the zone's label, not a heading. */
export function OutlineChapterRow({
  chapter,
  mark,
  number,
  params,
}: {
  chapter: OutlineChapter;
  mark?: ReactNode;
  number: number;
  params: OutlineParams;
}) {
  return (
    <li className={cn(ROW_CLASS, chapter.lessons.length === 1 && LONE_LESSON_ROW_CLASS)}>
      <RouteMark className={ROW_STATION_CLASS} station="stop" />

      <span className="text-faint w-6 flex-none font-mono text-xs leading-5.5 tabular-nums">
        {number}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <h3 className="text-[0.9375rem] leading-5.5 font-semibold text-balance">
            <Link
              className={CHAPTER_LINK_CLASS}
              href={getChapterHref({ ...params, chapterSlug: chapter.slug })}
              prefetch
            >
              {chapter.title}
            </Link>
          </h3>

          {mark && <p className={MARK_CLASS}>{mark}</p>}
        </div>

        {chapter.lessons.length > 0 && <ChapterLessonLinks chapter={chapter} params={params} />}
      </div>
    </li>
  );
}
