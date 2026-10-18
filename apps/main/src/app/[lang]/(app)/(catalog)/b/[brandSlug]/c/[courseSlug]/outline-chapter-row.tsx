import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { type LibraryOutline } from "@/data/catalog/resolve-catalog-route";
import { Link } from "@/i18n/navigation";
import { getChapterHref, getLessonHref } from "@/lib/public/public-hrefs";
import { cn } from "@zoonk/ui/lib/utils";
import { Fragment, type ReactNode } from "react";

export type OutlineParams = { brandSlug: string; courseSlug: string };
export type OutlineBand = LibraryOutline["levels"][number];
export type OutlineChapter = OutlineBand["chapters"][number];

/** A no-break space keeps each dot at the end of a line, never at the start of the next. */
export const OUTLINE_SEPARATOR = " · ";

/*
 * A row's targets stay inside the row and never overlap, so a tap opens what it lands on, and each
 * is at least 44px each way while its focus ring stays around its words. The chapter's title
 * reaches up through the row's top padding (`py-5`) to its lessons' line (`mt-1`). A chapter's
 * only lesson stands alone on its line rather than in a run of links, so it takes a target of its
 * own, reaching down through its row's bottom padding (`pb-5.5`). Links in a run stay in the
 * text's own line height.
 */
const ROW_CLASS = "flex gap-4 border-b py-5 last:border-b-0";
const LONE_LESSON_ROW_CLASS = "pb-5.5";

const CHAPTER_LINK_CLASS =
  "focus-visible:ring-ring/50 relative inline-block rounded-md outline-none before:absolute before:inset-x-0 before:-top-5 before:-bottom-1 before:min-w-11 hover:underline hover:underline-offset-4 focus-visible:ring-[3px]";

const LESSON_LINK_CLASS =
  "hover:text-foreground focus-visible:ring-ring/50 rounded-sm outline-none hover:underline hover:underline-offset-4 focus-visible:ring-[3px]";

const LONE_LESSON_LINK_CLASS =
  "relative inline-block before:absolute before:inset-x-0 before:top-0 before:-bottom-5.5 before:min-w-11";

/** A chapter's place in the plan beside its title: quiet, in the mono face. */
const MARK_CLASS = cn(NUMERIC_CLASS, "text-muted-foreground flex-none text-xs leading-6");

/** A chapter's lessons in one line, one link each, a lone lesson on a target of its own. */
function ChapterLessonLinks({
  chapter,
  params,
}: {
  chapter: OutlineChapter;
  params: OutlineParams;
}) {
  const hasLoneLesson = chapter.lessons.length === 1;

  return (
    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
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

/**
 * A chapter in the outline: its number, its title (a heading under the section's, since a level's
 * or an area's name is the disclosure's label, not a heading), its place in the example plan when
 * there is one (`mark`), and its lessons in one line, one link each.
 */
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
      <span className="text-faint w-6 flex-none pt-0.5 font-mono text-xs leading-6 tabular-nums">
        {number}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <h3 className="text-[0.9375rem] leading-snug font-semibold text-balance">
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
