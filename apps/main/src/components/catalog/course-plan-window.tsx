import { DayList, type DayListStep } from "@/components/public/day-list";
import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { ProductWindow } from "@/components/public/product-window";
import { getApproxDurationFormatter, getMinutesFormatter } from "@/lib/public/public-labels";
import { BigQuantity } from "@zoonk/learn/big-quantity";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon } from "lucide-react";
import { getExtracted, getFormatter } from "next-intl/server";
import { type ReactNode } from "react";
import { type CoursePlanExample } from "./course-plan";
import {
  type DatedEstimate,
  type UndatedEstimate,
  getStudyMinutes,
  isDatedEstimate,
} from "./plan-estimate";
import { PlanWorkload } from "./plan-workload";

/** Today's rows the window lists before folding the rest into one line. */
const TODAY_ROWS = 3;

/**
 * A plan ending within this many days names no finish month: its few weeks already say when, and
 * the Plan names a near end by its day rather than its month.
 */
const NEAR_ESTIMATE_DAYS = 42;
const MS_PER_DAY = 86_400_000;

/** The window and its caption. */
const WINDOW_COLUMN_CLASS = "flex min-w-0 flex-col gap-3.5";

/**
 * The window lays itself out by the room it gets: one column beside the hero or on a phone, two
 * from 48rem (the page's width), the result on the left and the first day on the right.
 */
const WINDOW_BODY_CLASS =
  "grid grid-cols-1 gap-5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @3xl:gap-x-14";

/** The right half's first block drops the hairline that separates it in one column. */
const WINDOW_DETAILS_CLASS =
  "flex min-w-0 flex-col gap-5 @3xl:[&>*:first-child]:border-t-0 @3xl:[&>*:first-child]:pt-0";

/** The headline number, big, through the one quantity treatment; its word beside it. */
function renderBig(chunks: ReactNode) {
  const parts: unknown[] = Array.isArray(chunks) ? chunks : [chunks];
  const text = parts.filter((part) => typeof part === "string").join("");
  return <BigQuantity className="text-[2.75rem]">{text}</BigQuantity>;
}

/** The finish month in the sentence's own face, a step heavier, so it reads as the line's answer. */
function renderStrong(chunks: ReactNode) {
  return <strong className="font-semibold">{chunks}</strong>;
}

const BIG_LINE_CLASS =
  "flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold tracking-[-0.03em]";

const RESULT_LINE_CLASS = "text-muted-foreground max-w-[30rem] text-sm leading-relaxed text-pretty";

/**
 * When the example plan ends, as the Plan writes a far estimate, by its month ("February 2027");
 * null for one ending within a few weeks.
 */
async function getEndMonthText({ endDate, fromDate }: { endDate: string; fromDate: string }) {
  const format = await getFormatter();
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = (end.getTime() - new Date(`${fromDate}T00:00:00Z`).getTime()) / MS_PER_DAY;

  return days > NEAR_ESTIMATE_DAYS
    ? format.dateTime(end, { month: "long", timeZone: "UTC", year: "numeric" })
    : null;
}

/**
 * The course to its end at one time a day: how many weeks it takes from scratch, and the month it
 * ends for someone starting today, the estimate the Plan's road ends with.
 */
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
    <div className="flex flex-col gap-2.5">
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
        <p className="flex gap-2 text-sm leading-relaxed font-medium text-pretty">
          <LineMarker>
            <FlagIcon aria-hidden="true" className="size-3.5" />
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

/**
 * The plan's first day as Today lists it: its first few lessons and the rest folded into one line.
 * Each row is the part of its lesson the day holds (`dayMinutes`), not the whole lesson: a 20-minute
 * lesson on a 15-minute day shows 15. Minutes stay exact until they're written, so the totals are
 * the day's own time, never a sum of rounded rows.
 */
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
    <div className="flex flex-col gap-1.5 border-t pt-4">
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-label">{t("Today")}</span>
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
 * An exam course against the exam's day at one time a day: the time it studies by then, from the
 * plan's own numbers (never only the lessons, which undercount a plan that also reviews, practices
 * and writes lessons ahead), then what that time holds: the course's lessons that fit, and whether
 * all of it fits. Never how much: that share assumes a start from scratch and shrinks with the
 * course's size, so onboarding's time question says it, at the visitor's level and time.
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
  const durationText = await getApproxDurationFormatter();
  // The big number in the mono face, "~3 h", its words beside it.
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

  /** Whether all of it fits in depth by the exam, by the exam's topics or by the goal's. */
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
    <div className="flex flex-col gap-2.5">
      <p className={BIG_LINE_CLASS}>
        {t.rich("<big>{time}</big> of study", { big: renderBig, time: studyTime })}
      </p>

      <p className={RESULT_LINE_CLASS}>{holds()}</p>

      {coverage && <p className={RESULT_LINE_CLASS}>{fitText(coverage)}</p>}
    </div>
  );
}

/**
 * The course's selected public example: its result at one time a day (the weeks to its end and
 * when that is, or what fits by the exam), what fills that time and its first day. The outline
 * reads the same estimate. With no estimate the window is hidden; the caption explains the
 * example.
 */
export async function CoursePlanWindow({
  chapterTitles,
  className,
  examDate,
  isExam,
  plan,
}: {
  chapterTitles: Map<string, string>;
  className?: string;
  /** An exam course, with or without a known sitting: its plan holds mock exams. */
  isExam: boolean;
  /** The exam's first day as the page writes it, for an exam course read against it. */
  examDate: string | null;
  plan: CoursePlanExample;
}) {
  const t = await getExtracted();
  const { pace } = plan;

  if (!pace) {
    return null;
  }

  const { estimate } = pace;
  const workload = <PlanWorkload exam={isExam} numbers={estimate.numbers} />;

  // The first day, when there's one, fills the right half; the time and what fills it stay
  // together on the left. An exam's plan has no first day to show, so what fills it moves over.
  const today = !isDatedEstimate(estimate) && estimate.firstDay.length > 0 && (
    <UndatedToday chapterTitles={chapterTitles} estimate={estimate} />
  );

  return (
    <div className={cn(WINDOW_COLUMN_CLASS, className)} data-slot="course-plan">
      <ProductWindow className="@container p-5 sm:p-7">
        <div className={WINDOW_BODY_CLASS}>
          <div className="flex min-w-0 flex-col gap-5">
            <h2 className="text-label">{t("Example plan")}</h2>

            {isDatedEstimate(estimate) ? (
              <DatedHeadline date={examDate ?? ""} estimate={estimate} minutes={pace.minutes} />
            ) : (
              <UndatedHeadline estimate={estimate} minutes={pace.minutes} />
            )}

            {today && workload}
          </div>

          <div className={WINDOW_DETAILS_CLASS}>{today || workload}</div>
        </div>
      </ProductWindow>

      <p className="text-muted-foreground text-[13px] text-pretty">
        {t("An example. Your plan follows your answers, so it can start later and end sooner.")}
      </p>
    </div>
  );
}
