import { DayList, type DayListStep } from "@/components/public/day-list";
import { NUMERIC_CLASS } from "@/components/public/landing-styles";
import { ProductWindow } from "@/components/public/product-window";
import {
  PRESET_OPTION_CLASS,
  Variant,
  VariantSwitch,
  VariantSwitchOption,
} from "@/components/public/variant-switch";
import { getMinutesFormatter } from "@/lib/public/public-labels";
import { getTotalDuration } from "@/lib/public/total-duration";
import { BigQuantity } from "@zoonk/learn/big-quantity";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted, getFormatter } from "next-intl/server";
import { type ReactNode } from "react";
import { type CoursePlanExample, getFirstShownPace } from "./course-plan";
import {
  type DatedEstimate,
  type UndatedEstimate,
  getStudyMinutes,
  isDatedEstimate,
} from "./plan-estimate";
import { PlanWorkloadRows } from "./plan-workload";

const MINUTES_PER_HOUR = 60;

/** Today's rows the window lists before folding the rest into one line. */
const TODAY_ROWS = 3;

/** The window beside the hero from `lg`, under it before. */
const WINDOW_COLUMN_CLASS = "flex min-w-0 flex-col gap-3.5";

/** The headline number, big, through the one quantity treatment; its word beside it. */
function renderBig(chunks: ReactNode) {
  const parts: unknown[] = Array.isArray(chunks) ? chunks : [chunks];
  const text = parts.filter((part) => typeof part === "string").join("");
  return <BigQuantity className="text-[2.75rem]">{text}</BigQuantity>;
}

const BIG_LINE_CLASS =
  "flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold tracking-[-0.03em]";

const RESULT_LINE_CLASS = "text-muted-foreground max-w-[30rem] text-sm leading-relaxed text-pretty";

/** The course to its end at one time a day: how many weeks it takes from scratch. */
async function UndatedHeadline({
  estimate,
  minutes,
}: {
  estimate: UndatedEstimate;
  minutes: number;
}) {
  const t = await getExtracted();

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
          "to finish the whole course at {minutes, plural, one {# minute} other {# minutes}} a day, Monday to Friday, from scratch. Reviews included; skipping what you know makes it shorter.",
          { minutes },
        )}
      </p>
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
 * and writes lessons ahead), then what that time holds: the course's lessons that fit, and what
 * share of the exam it studies in depth, the same measure onboarding's time question shows.
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
  const format = await getFormatter();
  const minutesText = await getMinutesFormatter();
  const study = getTotalDuration(getStudyMinutes(estimate));
  // The big number in the mono face, "~3 h", its words beside it.
  const studyTime =
    "minutes" in study
      ? minutesText(study.minutes)
      : `~${minutesText(study.hours * MINUTES_PER_HOUR)}`;

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
      "by {date}, at {time} a day, Monday to Friday, what comes up most first: {count, number} of the course's {total, plural, one {# lesson} other {# lessons}}. What doesn't fit is left out, and you see what.",
      {
        count: estimate.fittingLessons,
        date,
        time: minutesText(minutes),
        total: estimate.publishedContent.lessons,
      },
    );
  };

  const share = coverage
    ? format.number(coverage.coveredShare, { maximumFractionDigits: 0, style: "percent" })
    : null;

  /**
   * What share of the plan's topics it studies in depth, as onboarding's time question says it:
   * counted over the topics the plan holds (an exam's, by what each is worth on it), never over a
   * whole exam the plan may not fully hold, so it never says "all of the exam".
   */
  const coverageText = ({
    coverage: { coveredShare, measure },
    share: percent,
  }: {
    coverage: NonNullable<typeof coverage>;
    share: string;
  }) => {
    if (measure === "goal") {
      return coveredShare >= 1
        ? t("That's every topic in the plan, in depth.")
        : t("That's ~{share} of the plan's topics in depth, what matters most first.", {
            share: percent,
          });
    }

    return coveredShare >= 1
      ? t("That's every exam topic in the plan, in depth.")
      : t(
          "That's ~{share} of the plan's exam topics in depth, weighed by what each is worth on the exam rather than by lessons.",
          { share: percent },
        );
  };

  return (
    <div className="flex flex-col gap-2.5">
      <p className={BIG_LINE_CLASS}>
        {t.rich("<big>{time}</big> of study", { big: renderBig, time: studyTime })}
      </p>

      <p className={RESULT_LINE_CLASS}>
        {holds()} {coverage && share && coverageText({ coverage, share })}
      </p>
    </div>
  );
}

/**
 * Whether a pace has rows to list under its headline: the plan's first day. An exam's areas are
 * the outline's, right under the window, so the window doesn't repeat them.
 */
function hasPaceDetails(estimate: DatedEstimate | UndatedEstimate): estimate is UndatedEstimate {
  return !isDatedEstimate(estimate) && estimate.firstDay.length > 0;
}

/**
 * The course as the visitor's plan, in the app's window: pick a time a day (native radios, every
 * pace's plan in the page, the picked one showing) and see what it comes to, the result in a
 * headline in a polite live region so screen readers hear the new number. The outline's marks follow the same
 * radios. Numbers come only from core's estimate; with none, the page shows no window. A caption
 * says it's an example.
 *
 * `paceSwitch` names the radios, unique per course: the router may keep two courses' pages.
 */
export async function CoursePlanWindow({
  chapterTitles,
  className,
  examDate,
  isExam,
  paceSwitch,
  plan,
}: {
  chapterTitles: Map<string, string>;
  className?: string;
  /** An exam course, with or without a known sitting: its plan holds mock exams. */
  isExam: boolean;
  /** The exam's first day as the page writes it, for an exam course read against it. */
  examDate: string | null;
  paceSwitch: string;
  plan: CoursePlanExample;
}) {
  const t = await getExtracted();
  const minutesText = await getMinutesFormatter();
  const { paces } = plan;
  const shown = getFirstShownPace(plan);

  if (shown === null) {
    return null;
  }

  const values = paces.map((pace) => String(pace.minutes));
  const defaultValue = String(shown);

  const labelId = `${paceSwitch}-label`;

  return (
    <div className={cn(WINDOW_COLUMN_CLASS, className)} data-slot="course-plan">
      <ProductWindow className="flex flex-col gap-5 p-5 sm:p-7">
        <h2 className="text-label">{t("Example plan")}</h2>

        <VariantSwitch
          aria-labelledby={labelId}
          className="flex flex-wrap items-center gap-2"
          defaultValue={defaultValue}
          name={paceSwitch}
          values={values}
        >
          <span className="text-muted-foreground mr-1 text-[0.8125rem]" id={labelId}>
            {t("Time a day")}
          </span>

          {paces.map((pace) => (
            <VariantSwitchOption
              className={PRESET_OPTION_CLASS}
              defaultValue={defaultValue}
              key={pace.minutes}
              name={paceSwitch}
              value={String(pace.minutes)}
            >
              {minutesText(pace.minutes)}
            </VariantSwitchOption>
          ))}
        </VariantSwitch>

        {/* Only the headline is live, so a new time a day reads its number, not every row. */}
        <div aria-live="polite">
          {paces.map((pace) => (
            <Variant key={pace.minutes} name={paceSwitch} value={String(pace.minutes)}>
              {isDatedEstimate(pace.estimate) ? (
                <DatedHeadline
                  date={examDate ?? ""}
                  estimate={pace.estimate}
                  minutes={pace.minutes}
                />
              ) : (
                <UndatedHeadline estimate={pace.estimate} minutes={pace.minutes} />
              )}
            </Variant>
          ))}
        </div>

        {paces.map((pace) => (
          <Variant key={pace.minutes} name={paceSwitch} value={String(pace.minutes)}>
            <PlanWorkloadRows exam={isExam} numbers={pace.estimate.numbers} />
          </Variant>
        ))}

        {paces.map(
          (pace) =>
            hasPaceDetails(pace.estimate) && (
              <Variant key={pace.minutes} name={paceSwitch} value={String(pace.minutes)}>
                <UndatedToday chapterTitles={chapterTitles} estimate={pace.estimate} />
              </Variant>
            ),
        )}
      </ProductWindow>

      <p className="text-muted-foreground text-[13px] text-pretty">
        {t("An example. Your plan follows your answers, so it can start later and end sooner.")}
      </p>
    </div>
  );
}
