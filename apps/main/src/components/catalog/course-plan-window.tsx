import { DayList, type DayListStep } from "@/components/public/day-list";
import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { getMinutesFormatter } from "@/lib/public/public-labels";
import { type UndatedEstimate } from "@zoonk/core/catalog/course-plan-example-contract";
import { BigQuantity } from "@zoonk/learn/big-quantity";
import { RouteMark, RouteTitle } from "@zoonk/learn/route-line";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";

const DAY_ROWS = 3;

const PLAN_BODY_CLASS =
  "grid grid-cols-1 gap-9 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @3xl:gap-x-16";

function renderBig(chunks: ReactNode) {
  const parts: unknown[] = Array.isArray(chunks) ? chunks : [chunks];
  const text = parts.filter((part) => typeof part === "string").join("");

  return (
    <BigQuantity className="text-foreground text-[2.5rem] sm:text-[3.5rem]">{text}</BigQuantity>
  );
}

/** Minutes stay exact until they're written, so the totals are the day's own time, never a sum of rounded rows. */
async function FirstDay({
  chapterTitles,
  estimate,
}: {
  chapterTitles: Map<string, string>;
  estimate: UndatedEstimate;
}) {
  const t = await getExtracted();
  const minutesText = await getMinutesFormatter();

  const steps: DayListStep[] = estimate.firstDay.map((lesson, index) => ({
    detail: lesson.chapterId ? chapterTitles.get(lesson.chapterId) : undefined,
    id: lesson.lessonId,
    kind: "lesson",
    minutes: lesson.dayMinutes,
    state: index === 0 ? "current" : "ahead",
    title: lesson.title,
  }));

  const shown = steps.slice(0, DAY_ROWS);
  const folded = steps.slice(DAY_ROWS);
  const dayMinutes = steps.reduce((sum, step) => sum + step.minutes, 0);
  const foldedMinutes = folded.reduce((sum, step) => sum + step.minutes, 0);

  return (
    <div className="flex min-w-0 flex-col">
      <p className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-reading font-semibold">
          {t({
            description:
              "Heading over the lessons a new learner would study on the first day of this course.",
            message: "Your first day",
          })}
        </span>
        <span className={cn(NUMERIC_CLASS, "text-muted-foreground text-xs")}>
          {t("{count, plural, one {# lesson} other {# lessons}}", { count: steps.length })}
          {" · "}
          {minutesText(dayMinutes)}
        </span>
      </p>

      <DayList minutesText={minutesText} steps={shown} />

      {folded.length > 0 && (
        <p className={cn(NUMERIC_CLASS, "text-muted-foreground border-t pt-2.5 text-xs")}>
          {t("+ {count, plural, one {# more lesson} other {# more lessons}}", {
            count: folded.length,
          })}
          {" · "}
          {minutesText(foldedMinutes)}
        </p>
      )}
    </div>
  );
}

/**
 * One number and one real day. What a plan leaves out, what isn't ready and how its hours split are
 * a learner's own plan's to say, at their level and their time.
 */
export async function CoursePlanWindow({
  chapterTitles,
  className,
  estimate,
  minutes,
  onRoute = false,
  titleId,
}: {
  chapterTitles: Map<string, string>;
  className?: string;
  estimate: UndatedEstimate;
  minutes: number;
  onRoute?: boolean;
  titleId: string;
}) {
  const t = await getExtracted();

  const title = t({
    description: "Heading on a course's page: how long the whole course takes to finish.",
    message: "How long it takes",
  });

  return (
    <div
      className={cn("@container flex min-w-0 flex-col gap-7", className)}
      data-slot="course-plan"
    >
      {onRoute ? (
        <RouteTitle down id={titleId}>
          {title}
        </RouteTitle>
      ) : (
        <h2 className="text-section relative" id={titleId}>
          <RouteMark className="xl:hidden" down up />
          {title}
        </h2>
      )}

      <div className={PLAN_BODY_CLASS}>
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-muted-foreground flex flex-wrap items-baseline gap-x-2 text-lg font-medium tracking-[-0.01em]">
            {t.rich("{weeks, plural, one {<big>~#</big> week} other {<big>~#</big> weeks}}", {
              big: renderBig,
              weeks: estimate.weeks,
            })}
          </p>

          <p className="text-muted-foreground text-reading max-w-120 leading-relaxed text-pretty">
            {t({
              description:
                "Under a big number of weeks (“~32 weeks”): how long the course takes when studying this many minutes a day.",
              message:
                "Studying {minutes, plural, one {# minute} other {# minutes}} a day. Your plan skips what you already know, so it can take less.",
              values: { minutes },
            })}
          </p>
        </div>

        {estimate.firstDay.length > 0 && (
          <FirstDay chapterTitles={chapterTitles} estimate={estimate} />
        )}
      </div>
    </div>
  );
}
