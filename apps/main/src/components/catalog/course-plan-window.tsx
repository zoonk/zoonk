import { DayList, type DayListStep } from "@/components/public/day-list";
import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { getMinutesFormatter, getTotalDurationFormatter } from "@/lib/public/public-labels";
import {
  type CoursePlanExample,
  type DatedEstimate,
  type UndatedEstimate,
  getStudyMinutes,
  isDatedEstimate,
} from "@zoonk/core/catalog/course-plan-example-contract";
import { BigQuantity } from "@zoonk/learn/big-quantity";
import { RouteTitle } from "@zoonk/learn/route-line";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";
import { type ReactNode } from "react";
import { PlanWorkload } from "./plan-workload";

const TODAY_ROWS = 3;

const NEAR_ESTIMATE_DAYS = 42;
const MS_PER_DAY = 86_400_000;

const PLAN_BODY_CLASS =
  "grid grid-cols-1 gap-10 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @3xl:gap-x-16";

function renderBig(chunks: ReactNode) {
  const parts: unknown[] = Array.isArray(chunks) ? chunks : [chunks];
  const text = parts.filter((part) => typeof part === "string").join("");
  return <BigQuantity className="text-foreground text-5xl sm:text-[3.5rem]">{text}</BigQuantity>;
}

function renderStrong(chunks: ReactNode) {
  return <strong className="font-semibold">{chunks}</strong>;
}

const BIG_LINE_CLASS =
  "text-muted-foreground flex flex-wrap items-baseline gap-x-2 text-lg font-medium tracking-[-0.01em]";

const RESULT_LINE_CLASS =
  "text-muted-foreground max-w-[30rem] text-[0.9375rem] leading-relaxed text-pretty";

async function getEndMonthText({ endDate, fromDate }: { endDate: string; fromDate: string }) {
  const format = await getFormatter();
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = (end.getTime() - new Date(`${fromDate}T00:00:00Z`).getTime()) / MS_PER_DAY;

  return days > NEAR_ESTIMATE_DAYS
    ? format.dateTime(end, { month: "long", timeZone: "UTC", year: "numeric" })
    : null;
}

async function UndatedHeadline({
  estimate,
  minutes,
}: {
  estimate: UndatedEstimate;
  minutes: number;
}) {
  const t = await getExtracted();

  const endMonth =
    estimate.endDate &&
    (await getEndMonthText({
      endDate: estimate.endDate,
      fromDate: estimate.numbers.context.fromDate,
    }));

  return (
    <div className="flex flex-col gap-3">
      <p className={BIG_LINE_CLASS}>
        {t.rich("{weeks, plural, one {<big>~#</big> week} other {<big>~#</big> weeks}}", {
          big: renderBig,
          weeks: estimate.weeks,
        })}
      </p>

      <p className={RESULT_LINE_CLASS}>
        {t(
          "to finish the whole course at {minutes, plural, one {# minute} other {# minutes}} a day, Monday to Friday, from scratch.",
          { minutes },
        )}
      </p>

      {endMonth && (
        <p className="flex gap-2 text-[0.9375rem] leading-relaxed text-pretty">
          <LineMarker>
            <FlagIcon aria-hidden="true" className="text-muted-foreground size-4" />
          </LineMarker>
          <span>
            {t.rich("Starting today, you'd finish around <strong>{month}</strong>.", {
              month: endMonth,
              strong: renderStrong,
            })}
          </span>
        </p>
      )}
    </div>
  );
}

/** Minutes stay exact until they're written, so the totals are the day's own time, never a sum of rounded rows. */
async function UndatedToday({
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

  const shown = steps.slice(0, TODAY_ROWS);
  const folded = steps.slice(TODAY_ROWS);
  const dayMinutes = steps.reduce((sum, step) => sum + step.minutes, 0);
  const foldedMinutes = folded.reduce((sum, step) => sum + step.minutes, 0);

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-[0.9375rem] font-semibold">{t("Today")}</span>
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
 * Never only the lessons' time, which undercounts a plan that also reviews and practices. Never how
 * much fits: that share assumes a start from scratch, so onboarding says it at the visitor's level.
 */
async function DatedHeadline({
  date,
  estimate,
  minutes,
}: {
  date: string;
  estimate: DatedEstimate;
  minutes: number;
}) {
  const t = await getExtracted();
  const minutesText = await getMinutesFormatter();
  const durationText = await getTotalDurationFormatter();
  const studyTime = durationText(getStudyMinutes(estimate));

  const hasQuickLessons = estimate.areas.some((area) => area.quickLessons > 0);
  const writesLessons = estimate.workload.unwrittenLessonMinutes > 0;
  const coverage = estimate.numbers.coverage;

  const holds = () => {
    if (writesLessons) {
      return t(
        "by {date}, at {time} a day, Monday to Friday, what comes up most first: {count, plural, =0 {lessons} one {# lesson} other {# lessons}} already in the course, and more written as you reach them.",
        { count: estimate.fittingLessons, date, time: minutesText(minutes) },
      );
    }

    if (hasQuickLessons || estimate.fittingLessons === 0) {
      return t(
        "by {date}, at {time} a day, Monday to Friday, in quick lessons on what comes up most. The full lessons come once there's more time.",
        { date, time: minutesText(minutes) },
      );
    }

    return t(
      "by {date}, at {time} a day, Monday to Friday, what comes up most first: {count, number} of the course's {total, plural, one {# lesson} other {# lessons}}.",
      {
        count: estimate.fittingLessons,
        date,
        time: minutesText(minutes),
        total: estimate.publishedContent.lessons,
      },
    );
  };

  const fitText = ({ coveredShare, measure }: NonNullable<typeof coverage>) => {
    if (coveredShare < 1) {
      return t(
        "Not all of it fits by then. Before you start, you see how much fits at your level and your time.",
      );
    }

    return measure === "goal"
      ? t("That's every topic in the course, in depth.")
      : t("That's every exam topic in the course, in depth.");
  };

  return (
    <div className="flex flex-col gap-3">
      <p className={BIG_LINE_CLASS}>
        {t.rich("<big>{time}</big> of study", { big: renderBig, time: studyTime })}
      </p>

      <p className={RESULT_LINE_CLASS}>{holds()}</p>

      {coverage && <p className={RESULT_LINE_CLASS}>{fitText(coverage)}</p>}
    </div>
  );
}

export async function CoursePlanWindow({
  chapterTitles,
  className,
  examDate,
  isExam,
  onRoute = false,
  plan,
  titleId,
}: {
  chapterTitles: Map<string, string>;
  className?: string;
  isExam: boolean;
  examDate: string | null;
  onRoute?: boolean;
  plan: CoursePlanExample;
  titleId: string;
}) {
  const t = await getExtracted();
  const { pace } = plan;

  if (!pace) {
    return null;
  }

  const { estimate } = pace;
  const workload = <PlanWorkload exam={isExam} numbers={estimate.numbers} />;

  const today = !isDatedEstimate(estimate) && estimate.firstDay.length > 0 && (
    <UndatedToday chapterTitles={chapterTitles} estimate={estimate} />
  );

  const caption = (
    <p className="text-muted-foreground text-[13px] leading-relaxed text-pretty">
      {t("An example. Your plan follows your answers, so it can start later and end sooner.")}
    </p>
  );

  return (
    <div
      className={cn("@container flex min-w-0 flex-col gap-7", className)}
      data-slot="course-plan"
    >
      {onRoute ? (
        <RouteTitle down id={titleId}>
          {t("Example plan")}
        </RouteTitle>
      ) : (
        <h2 className="text-section" id={titleId}>
          {t("Example plan")}
        </h2>
      )}

      <div className={PLAN_BODY_CLASS}>
        <div className="flex min-w-0 flex-col gap-9">
          {isDatedEstimate(estimate) ? (
            <DatedHeadline date={examDate ?? ""} estimate={estimate} minutes={pace.minutes} />
          ) : (
            <UndatedHeadline estimate={estimate} minutes={pace.minutes} />
          )}

          {today && workload}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {today || workload}
          {caption}
        </div>
      </div>
    </div>
  );
}
