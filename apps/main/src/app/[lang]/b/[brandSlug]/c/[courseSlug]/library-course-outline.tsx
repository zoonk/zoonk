import {
  SECTION_CLASS,
  SECTION_LEAD_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/public/landing-styles";
import { PublicDisclosure } from "@/components/public/public-disclosure";
import { type LibraryOutline } from "@/data/catalog/resolve-catalog-route";
import { Link } from "@/i18n/navigation";
import { getChapterHref, getLessonHref } from "@/lib/public/public-hrefs";
import { getLevelLabel } from "@/lib/public/public-labels";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { Fragment } from "react";

type Params = { brandSlug: string; courseSlug: string };
type OutlineChapter = LibraryOutline["levels"][number]["chapters"][number];

/** A no-break space keeps each dot at the end of a line, never at the start of the next. */
const LESSON_SEPARATOR = "\u00A0· ";

const CHAPTER_LINK_CLASS =
  "focus-visible:ring-ring/50 -my-3 inline-block rounded-md py-3 outline-none hover:underline hover:underline-offset-4 focus-visible:ring-[3px]";

/** A chapter in the full outline: its number, its title and its lessons in one line. */
function OutlineChapterRow({
  chapter,
  number,
  params,
}: {
  chapter: OutlineChapter;
  number: number;
  params: Params;
}) {
  return (
    <li className="flex gap-4 border-b py-4 last:border-b-0">
      <span className="text-muted-foreground w-6 flex-none pt-0.5 text-sm font-medium tabular-nums">
        {number}
      </span>

      <div className="min-w-0 flex-1">
        <h4 className="text-base leading-snug font-semibold text-balance">
          <Link
            className={CHAPTER_LINK_CLASS}
            href={getChapterHref({ ...params, chapterSlug: chapter.slug })}
          >
            {chapter.title}
          </Link>
        </h4>

        {chapter.lessons.length > 0 && (
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {chapter.lessons.map((lesson, index) => (
              <Fragment key={lesson.id}>
                {index > 0 && LESSON_SEPARATOR}
                <Link
                  className="hover:text-foreground focus-visible:ring-ring/50 rounded-sm outline-none hover:underline hover:underline-offset-4 focus-visible:ring-[3px]"
                  href={getLessonHref({
                    ...params,
                    chapterSlug: chapter.slug,
                    lessonSlug: lesson.slug,
                  })}
                >
                  {lesson.title}
                </Link>
              </Fragment>
            ))}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Every level, chapter and lesson title, in the page's HTML for search engines, folded away so
 * the page stays calm. Lessons sit in a line under their chapter, one link each.
 */
async function FullOutline({ outline, params }: { outline: LibraryOutline; params: Params }) {
  const levelLabels = await Promise.all(outline.levels.map((band) => getLevelLabel(band.level)));

  const firstNumbers = outline.levels.map((_, index) =>
    outline.levels.slice(0, index).reduce((sum, band) => sum + band.chapters.length, 1),
  );

  return (
    <div className="flex flex-col gap-8 pt-2">
      {outline.levels.map((band, bandIndex) => (
        <div key={band.level}>
          <h3 className="text-muted-foreground text-[13px] font-medium tracking-wide uppercase">
            {levelLabels[bandIndex]}
          </h3>

          <ol className="mt-2">
            {band.chapters.map((chapter, chapterIndex) => (
              <OutlineChapterRow
                chapter={chapter}
                key={chapter.id}
                number={(firstNumbers[bandIndex] ?? 1) + chapterIndex}
                params={params}
              />
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

/**
 * What the course covers: its description and, one tap away, the full outline. The course
 * outline card at the top already shows its size and levels, so this adds only what it can't.
 * A course whose outline isn't written yet says when it will be.
 */
export async function LibraryCourseOutline({
  lead,
  outline,
  params,
}: {
  lead: string | null;
  outline: LibraryOutline;
  params: Params;
}) {
  const t = await getExtracted();
  const hasChapters = outline.levels.some((band) => band.chapters.length > 0);

  return (
    <section aria-labelledby="course-outline" className={cn(SECTION_CLASS, "mt-24 sm:mt-36")}>
      <div className="max-w-[760px]">
        <h2 className={SECTION_TITLE_CLASS} id="course-outline">
          {t("What you'll learn")}
        </h2>

        {lead && <p className={SECTION_LEAD_CLASS}>{lead}</p>}

        {hasChapters ? (
          <div className="mt-6 sm:mt-8">
            <PublicDisclosure summary={t("See all chapters and lessons")}>
              <FullOutline outline={outline} params={params} />
            </PublicDisclosure>
          </div>
        ) : (
          <p className="text-muted-foreground mt-6 text-[15px] leading-relaxed">
            {t("The chapters and lessons are written when the first learner starts.")}
          </p>
        )}
      </div>
    </section>
  );
}
