import { type PaceEstimate, isDatedEstimate } from "@/components/catalog/plan-estimate";
import { type LibraryOutline } from "@/data/catalog/resolve-catalog-route";
import { getLibraryOutlineStats } from "@/lib/public/library-outline";
import {
  getLevelLabels,
  getMinutesFormatter,
  getTotalDurationLabel,
} from "@/lib/public/public-labels";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "@zoonk/learn/page";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { AreaOutline } from "./outline-areas";
import { OutlineLevel } from "./outline-levels";

type Params = { brandSlug: string; courseSlug: string };

/**
 * The selected example the outline marks, and the exam's first day as the page writes it.
 */
export type OutlinePlan = { examDate: string | null; pace: PaceEstimate | null };

/**
 * What the selected example comes to over the outline: to the course's end from scratch, or to
 * the exam's day.
 */
async function OutlinePlanLine({
  examDate,
  pace,
}: {
  examDate: string | null;
  pace: PaceEstimate;
}) {
  const t = await getExtracted();
  const minutesText = await getMinutesFormatter();

  return (
    <p className="text-muted-foreground -mt-2 text-sm leading-relaxed text-pretty">
      {isDatedEstimate(pace.estimate) && examDate
        ? t("Your plan until {date}, at {time} a day", {
            date: examDate,
            time: minutesText(pace.minutes),
          })
        : t(
            "Your plan at {minutes, plural, one {# minute} other {# minutes}} a day, from scratch",
            { minutes: pace.minutes },
          )}
    </p>
  );
}

/**
 * One column under the hero; from `xl`, where the page is wider than a list should read, the
 * outline takes the page's width with its title, size, plan line and description in a column
 * beside the levels (kept in view while they scroll), as the pricing questions sit beside their
 * title.
 */
const OUTLINE_SECTION_CLASS =
  "max-w-[760px] xl:grid xl:max-w-none xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] xl:items-start xl:gap-x-12";

/** The outline's words: in the section's own flow until `xl`, then its column beside the levels. */
const OUTLINE_INTRO_CLASS = "contents xl:sticky xl:top-24 xl:flex xl:flex-col xl:gap-3";

/**
 * Everything the course covers, after the page has said what it is and how it becomes a plan: its
 * size in one quiet line (chapters, then lessons and their total time once they're written), its
 * description, then its levels, each folded to its name and first chapters, the first one open.
 * With the example plan (`plan`), each chapter says its week in it, and an exam course read
 * against its date groups its chapters by the exam's areas, each
 * saying how much of it fits. Every chapter and lesson title stays in the page's HTML once for
 * search engines, and each opens its own page. A course whose outline isn't written yet invites
 * the visitor to build their plan, which writes it for them.
 */
export async function LibraryCourseOutline({
  courseId,
  lead,
  outline,
  params,
  plan = null,
}: {
  courseId: string;
  lead: string | null;
  outline: LibraryOutline;
  params: Params;
  plan?: OutlinePlan | null;
}) {
  const t = await getExtracted();
  const stats = getLibraryOutlineStats(outline);
  const durationLabel = await getTotalDurationLabel(stats.totalMinutes);
  const levelLabels = await getLevelLabels();
  const pace = stats.chapterCount > 0 ? plan?.pace : null;
  const estimate = pace?.estimate;
  const areas = estimate && isDatedEstimate(estimate) ? estimate : null;
  const weeks = estimate && !isDatedEstimate(estimate) ? estimate : null;

  const firstNumbers = outline.levels.map((_, index) =>
    outline.levels.slice(0, index).reduce((sum, band) => sum + band.chapters.length, 1),
  );

  const titleId = `course-outline-${courseId}`;

  return (
    <PageSection aria-labelledby={titleId} className={OUTLINE_SECTION_CLASS}>
      <div className={OUTLINE_INTRO_CLASS}>
        <PageSectionHeader>
          <PageSectionTitle id={titleId}>{t("Course outline")}</PageSectionTitle>

          {stats.chapterCount > 0 && (
            <PageSectionDetail>
              {[
                t("{count, plural, one {# chapter} other {# chapters}}", {
                  count: stats.chapterCount,
                }),
                stats.lessonCount > 0 &&
                  t("{count, plural, one {# short lesson} other {# short lessons}}", {
                    count: stats.lessonCount,
                  }),
                stats.lessonCount > 0 && durationLabel,
              ]
                .filter(Boolean)
                .join(" · ")}
            </PageSectionDetail>
          )}
        </PageSectionHeader>

        {plan && pace && <OutlinePlanLine examDate={plan.examDate} pace={pace} />}

        {lead && (
          <p className="max-w-column text-[0.9375rem] leading-relaxed text-pretty">{lead}</p>
        )}

        {stats.chapterCount === 0 && (
          <p className="max-w-column flex gap-2.5 text-[0.9375rem] leading-relaxed text-pretty">
            <LineMarker>
              <SparklesIcon aria-hidden="true" className="text-muted-foreground size-4" />
            </LineMarker>
            <span>
              {t(
                "Build your plan and Zoonk writes this course's chapters and lessons for you, starting at your level.",
              )}
            </span>
          </p>
        )}
      </div>

      {areas && <AreaOutline estimate={areas} outline={outline} params={params} />}

      {stats.chapterCount > 0 && !areas && (
        <div className="flex flex-col">
          {outline.levels.map((band, index) => (
            <OutlineLevel
              band={band}
              firstNumber={firstNumbers[index] ?? 1}
              key={band.level}
              label={levelLabels[band.level]}
              open={index === 0}
              params={params}
              estimate={weeks}
            />
          ))}
        </div>
      )}
    </PageSection>
  );
}
