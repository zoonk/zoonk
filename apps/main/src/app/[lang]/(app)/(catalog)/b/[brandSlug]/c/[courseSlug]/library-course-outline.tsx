import { type PaceEstimate, isDatedEstimate } from "@/components/catalog/plan-estimate";
import { type LibraryOutline } from "@/data/catalog/resolve-catalog-route";
import { getLibraryOutlineStats } from "@/lib/public/library-outline";
import {
  getLevelLabels,
  getMinutesFormatter,
  getTotalDurationLabel,
} from "@/lib/public/public-labels";
import { RouteStop, RouteTitle } from "@zoonk/learn/route-line";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
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
    <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
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
 * Everything the course covers, a stop of its route after the page has said what it is and how it
 * becomes a plan: its size in one quiet line beside its title (chapters, then lessons and their
 * total time once they're written), its description, then its levels, zones the route runs
 * through, each folded to its name and first chapters, the first one open with its chapters as
 * stations.
 * With the example plan (`plan`), each chapter says its week in it, and an exam course read
 * against its date groups its chapters by the exam's areas, each
 * saying how much of it fits. Every chapter and lesson title stays in the page's HTML once for
 * search engines, and each opens its own page. A course whose outline isn't written yet invites
 * the visitor to build their plan, which writes it for them.
 */
export async function LibraryCourseOutline({
  className,
  courseId,
  lead,
  outline,
  params,
  plan = null,
}: {
  className?: string;
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
    <RouteStop aria-labelledby={titleId} className={cn("flex flex-col gap-8", className)}>
      <div className="max-w-column flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <RouteTitle down id={titleId} up>
            {t("Course outline")}
          </RouteTitle>

          {stats.chapterCount > 0 && (
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
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
            </span>
          )}
        </div>

        {plan && pace && <OutlinePlanLine examDate={plan.examDate} pace={pace} />}

        {lead && <p className="text-[0.9375rem] leading-relaxed text-pretty">{lead}</p>}

        {stats.chapterCount === 0 && (
          <p className="flex gap-2.5 text-[0.9375rem] leading-relaxed text-pretty">
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
        <div className="flex flex-col gap-2">
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
    </RouteStop>
  );
}
