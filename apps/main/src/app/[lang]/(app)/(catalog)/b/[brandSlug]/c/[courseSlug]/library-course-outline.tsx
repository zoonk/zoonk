import { CourseExampleNumbers } from "@/components/catalog/course-progress";
import { type LibraryOutline } from "@/data/catalog/resolve-catalog-route";
import { getLibraryOutlineStats } from "@/lib/public/library-outline";
import { getLevelLabels, getMinutesFormatter } from "@/lib/public/public-labels";
import {
  type PaceEstimate,
  isDatedEstimate,
} from "@zoonk/core/catalog/course-plan-example-contract";
import { listCourseLevels } from "@zoonk/core/library/courses/levels";
import { type CourseFormat } from "@zoonk/db/enums";
import { RouteStop, RouteTitle } from "@zoonk/learn/route-line";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { AreaOutline } from "./outline-areas";
import { OutlineLevel, UnwrittenLevel } from "./outline-levels";

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
  courseFormat,
  courseId,
  lead,
  outline,
  params,
  plan = null,
}: {
  className?: string;
  courseFormat: CourseFormat;
  courseId: string;
  lead: string | null;
  outline: LibraryOutline;
  params: Params;
  plan?: OutlinePlan | null;
}) {
  const t = await getExtracted();
  const stats = getLibraryOutlineStats(outline);
  const levelLabels = await getLevelLabels();
  const pace = stats.chapterCount > 0 ? plan?.pace : null;
  const estimate = pace?.estimate;
  const areas = estimate && isDatedEstimate(estimate) ? estimate : null;
  const weeks = estimate && !isDatedEstimate(estimate) ? estimate : null;

  const firstNumbers = outline.levels.map((_, index) =>
    outline.levels.slice(0, index).reduce((sum, band) => sum + band.chapters.length, 1),
  );

  const levels = listCourseLevels({
    format: courseFormat,
    written: outline.levels.map((band) => band.level),
  });

  const titleId = `course-outline-${courseId}`;

  return (
    <RouteStop aria-labelledby={titleId} className={cn("flex flex-col gap-8", className)}>
      <div className="max-w-column flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <RouteTitle down id={titleId}>
            {t({
              description:
                "Heading over the list of the course's chapters and lessons. Not the learner's study plan, so use a different word than “plan”.",
              message: "Course outline",
            })}
          </RouteTitle>

          {stats.chapterCount > 0 && (
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              {[
                t("{count, plural, one {# chapter} other {# chapters}}", {
                  count: stats.chapterCount,
                }),
                stats.lessonCount > 0 &&
                  t({
                    description:
                      "After the course's chapter count. Zoonk writes more lessons as learners reach them, so this counts only those written until now.",
                    message:
                      "{count, plural, one {# lesson written so far} other {# lessons written so far}}",
                    values: { count: stats.lessonCount },
                  }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </div>

        {plan && pace && (
          <CourseExampleNumbers courseId={courseId}>
            <OutlinePlanLine examDate={plan.examDate} pace={pace} />
          </CourseExampleNumbers>
        )}

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

      {areas && (
        <AreaOutline courseId={courseId} estimate={areas} outline={outline} params={params} />
      )}

      {stats.chapterCount > 0 && !areas && (
        <div className="flex flex-col gap-2">
          {levels.map((level) => {
            const index = outline.levels.findIndex((band) => band.level === level);
            const band = outline.levels[index];

            return band ? (
              <OutlineLevel
                band={band}
                courseId={courseId}
                firstNumber={firstNumbers[index] ?? 1}
                isFirst={index === 0}
                key={level}
                label={levelLabels[level]}
                params={params}
                estimate={weeks}
              />
            ) : (
              <UnwrittenLevel
                courseId={courseId}
                key={level}
                label={levelLabels[level]}
                level={level}
              />
            );
          })}
        </div>
      )}
    </RouteStop>
  );
}
