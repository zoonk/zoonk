import { type LibraryOutline } from "@/data/catalog/resolve-catalog-route";
import { getLibraryOutlineStats } from "@/lib/public/library-outline";
import {
  getLevelLabels,
  getMinutesFormatter,
  getTotalDurationLabel,
} from "@/lib/public/public-labels";
import {
  type PaceEstimate,
  isDatedEstimate,
} from "@zoonk/core/catalog/course-plan-example-contract";
import { RouteStop, RouteTitle } from "@zoonk/learn/route-line";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { AreaOutline } from "./outline-areas";
import { OutlineLevel } from "./outline-levels";

type Params = { brandSlug: string; courseSlug: string };

export type OutlinePlan = { examDate: string | null; pace: PaceEstimate | null };

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

/** Every chapter and lesson title stays in the page's HTML once, for search engines. */
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
          <RouteTitle down id={titleId}>
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
              {t({
                description:
                  "Describes what happens once the learner builds a plan; not a command. The learner builds and Zoonk writes, so use a different verb for each.",
                message:
                  "Build your plan and Zoonk writes this course's chapters and lessons for you, starting at your level.",
              })}
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
