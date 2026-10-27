"use client";

import { LANGUAGE_ACTIVITY_TYPES } from "@zoonk/core/language/activities";
import { type MockScheduleView } from "@zoonk/core/plans/view-contract";
import { getWeekShape } from "@zoonk/core/plans/week-shape";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { PlusMark } from "../_components/plus-lock";
import { useFormatDuration } from "../_utils/time-format";
import { LearnLink } from "../learn-link";
import { useActivityName } from "./plan-activities";
import { usePlanScreen } from "./plan-context";
import { PlanDateText } from "./plan-date-text";
import { type PlanEditorSection } from "./plan-editor-sections";

const TITLE_ID = "plan-properties-title";
const DAYS_PER_WEEK = 7;

/** A Sunday, so a weekday number (Sunday 0 to Saturday 6) is that many days after it. */
const FIRST_SUNDAY = Date.parse("2023-01-01T00:00:00Z");
const DAY_MS = 86_400_000;

/** The week from Monday, as weekday numbers (Sunday 0): a run of days reads Mon to Sun. */
const MONDAY_FIRST: readonly number[] = Array.from(
  { length: DAYS_PER_WEEK },
  (_, index) => (index + 1) % DAYS_PER_WEEK,
);

/** The shortest run of days worth saying as a range ("Mon – Fri") instead of a list. */
const MIN_RANGE_DAYS = 3;

/** "Mon": a weekday's short name, for a weekday number (Sunday 0). */
function useWeekdayShort() {
  const format = useFormatter();

  return (weekday: number) =>
    format.dateTime(new Date(FIRST_SUNDAY + weekday * DAY_MS), {
      timeZone: "UTC",
      weekday: "short",
    });
}

/** Whether the study days, read from Monday, are one run with no day off inside it. */
function isOneRun(days: readonly number[]): boolean {
  const positions = days.map((day) => MONDAY_FIRST.indexOf(day));

  return positions.every(
    (position, index) => index === 0 || position === (positions[index - 1] ?? 0) + 1,
  );
}

/** "Mon – Sat", "Every day" or "Mon, Wed, Fri": the plan's study days. */
function useStudyDaysText() {
  const t = useExtracted();
  const weekdayShort = useWeekdayShort();

  return (weekdayMinutes: readonly number[]): string => {
    const days = MONDAY_FIRST.filter((day) => (weekdayMinutes[day] ?? 0) > 0);
    const [first] = days;
    const last = days.at(-1);

    if (days.length === DAYS_PER_WEEK) {
      return t("Every day");
    }

    if (
      first !== undefined &&
      last !== undefined &&
      days.length >= MIN_RANGE_DAYS &&
      isOneRun(days)
    ) {
      return t("{first} – {last}", { first: weekdayShort(first), last: weekdayShort(last) });
    }

    return days.map((day) => weekdayShort(day)).join(", ");
  };
}

/** A value's numbers, in the mono face; its words stay in the text face. */
function mono(chunks: React.ReactNode) {
  return <span className="font-mono tabular-nums">{chunks}</span>;
}

/** "45 min", or "45 min · 1h weekends" when the weekend has its own time. */
function DailyTimeValue() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { plan } = usePlanScreen();
  const shape = getWeekShape(plan.schedule);

  if (shape.weekend === null) {
    return mono(formatDuration(shape.weekdays));
  }

  return t.rich("<mono>{weekdays}</mono> · <mono>{weekend}</mono> weekends", {
    mono,
    weekdays: formatDuration(shape.weekdays),
    weekend: formatDuration(shape.weekend),
  });
}

/** A row is a whole 44 px target: rows touch, so a larger hit area would reach into the next. */
const PROPERTY_ROW_CLASS =
  "hover:bg-muted focus-visible:ring-ring/50 -mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-md px-2 text-left text-[0.8125rem] transition-colors outline-none focus-visible:ring-[3px]";

/** A row's name, which keeps its words, and its value, cut short on the row when long. */
function PropertyRowParts({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <>
      <span className="text-muted-foreground max-w-[60%] shrink-0 truncate">{label}</span>
      <span className="line-clamp-2 min-w-0 py-1 text-right text-balance">{children}</span>
    </>
  );
}

/**
 * One setting as a row: its name, its value, and a tap opens "Adjust plan" at it. The name keeps
 * its words; a long value wraps to a second line, as the aside is narrow from 72rem: cut short on
 * one line, "Aos domingos, a cada 4 semanas" lost the weeks it's about.
 */
function PropertyRow({
  children,
  label,
  onOpen,
}: {
  children: React.ReactNode;
  label: string;
  onOpen: () => void;
}) {
  return (
    <li>
      <button className={PROPERTY_ROW_CLASS} onClick={onOpen} type="button">
        <PropertyRowParts label={label}>{children}</PropertyRowParts>
      </button>
    </li>
  );
}

/** A weekday number (Sunday 0) as the key of its plural name below. */
const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/**
 * When the mock exams ahead fall, saying only the pattern their days keep: "Sundays", "Sundays,
 * every 5 weeks", else the next one's day ("Next Oct 18", or the day alone when it's the last).
 */
function MockScheduleValue({ mocks }: { mocks: MockScheduleView }) {
  const t = useExtracted();
  const weekday = mocks.weekday === null ? null : WEEKDAY_KEYS[mocks.weekday];

  if (weekday) {
    const days = t(
      "{weekday, select, sunday {Sundays} monday {Mondays} tuesday {Tuesdays} wednesday {Wednesdays} thursday {Thursdays} friday {Fridays} saturday {Saturdays} other {}}",
      { weekday },
    );

    return mocks.everyWeeks && mocks.everyWeeks > 1
      ? t("{days}, every {weeks, plural, one {# week} other {# weeks}}", {
          days,
          weeks: mocks.everyWeeks,
        })
      : days;
  }

  const date = <PlanDateText isoDate={mocks.nextDate} />;

  return mocks.count > 1 ? t.rich("Next <date></date>", { date: () => date }) : date;
}

/**
 * The exam's mock exams still to take, by when they fall (`MockScheduleValue`). They aren't a
 * setting (they go on the week's last study day), so the row opens the exam's page, where they
 * are, like the next mock on the path; without Plus it's marked Plus.
 */
function MockExamsRow({ examHref, mocks }: { examHref: string | null; mocks: MockScheduleView }) {
  const t = useExtracted();
  const { plan } = usePlanScreen();

  const parts = (
    <PropertyRowParts label={t("Mock exams")}>
      {plan.access.mocksRequirePlus && <PlusMark className="mr-2 align-middle" />}
      <MockScheduleValue mocks={mocks} />
    </PropertyRowParts>
  );

  return (
    <li>
      {examHref ? (
        <LearnLink className={PROPERTY_ROW_CLASS} href={examHref}>
          {parts}
        </LearnLink>
      ) : (
        <div className={cn(PROPERTY_ROW_CLASS, "hover:bg-transparent")}>{parts}</div>
      )}
    </li>
  );
}

/**
 * The goal's date as the plan keeps it (an estimated day with "~", a named month as the month), in
 * the date's mono face; without one, words in the text face.
 */
function GoalDateValue() {
  const t = useExtracted();
  const { goal, plan } = usePlanScreen();
  const { targetDate, targetDateEstimated, targetDateNamedMonth } = plan.schedule;

  if (!targetDate) {
    return goal.kind === "exam" ? t("To be confirmed") : t("No date");
  }

  return (
    <PlanDateText
      estimate={targetDateEstimated}
      isoDate={targetDate}
      month={targetDateNamedMonth}
    />
  );
}

/**
 * The plan's settings at a glance, as properties: the goal's date, the time a day, the study days,
 * an exam's mock exams ahead, each exam choice (a choice still to make in amber) and a language's
 * practice ("Everything", or the kinds it keeps). A tap on one opens "Adjust plan" at it
 * (`onOpen`), where it changes; the mock exams open the exam's page (`examHref`).
 */
export function PlanProperties({
  className,
  examHref = null,
  onOpen,
}: {
  className?: string;
  examHref?: string | null;
  onOpen: (section: PlanEditorSection) => void;
}) {
  const t = useExtracted();
  const activityName = useActivityName();
  const studyDaysText = useStudyDaysText();
  const { goal, plan } = usePlanScreen();
  const skipped = new Set(plan.steering.skippedActivities);
  const practiced = LANGUAGE_ACTIVITY_TYPES.filter((activity) => !skipped.has(activity));

  return (
    <PageSection aria-labelledby={TITLE_ID} className={className} data-slot="plan-properties">
      <PageSectionHeader>
        <PageSectionTitle id={TITLE_ID}>{t("Your plan")}</PageSectionTitle>
      </PageSectionHeader>

      <ul className="flex flex-col">
        <PropertyRow
          label={goal.kind === "exam" ? t("Exam date") : t("Goal date")}
          onOpen={() => onOpen("date")}
        >
          <GoalDateValue />
        </PropertyRow>

        <PropertyRow label={t("Time a day")} onOpen={() => onOpen("time")}>
          <DailyTimeValue />
        </PropertyRow>

        <PropertyRow label={t("Study days")} onOpen={() => onOpen("days")}>
          {studyDaysText(plan.schedule.weekdayMinutes)}
        </PropertyRow>

        {plan.schedule.mocks && <MockExamsRow examHref={examHref} mocks={plan.schedule.mocks} />}

        {plan.examChoices.map((choice) => {
          const picked = choice.options.find((option) => option.name === choice.subject);

          return (
            <PropertyRow key={choice.group} label={choice.group} onOpen={() => onOpen("choices")}>
              <span className={cn(!picked && "text-warning-text font-medium")}>
                {picked ? (picked.shortName ?? picked.name) : t("Choose")}
              </span>
            </PropertyRow>
          );
        })}

        {goal.kind === "language" && practiced.length > 0 && (
          <PropertyRow label={t("Practice")} onOpen={() => onOpen("practice")}>
            {practiced.length === LANGUAGE_ACTIVITY_TYPES.length
              ? t("Everything")
              : practiced.map((activity) => activityName(activity)).join(" · ")}
          </PropertyRow>
        )}
      </ul>
    </PageSection>
  );
}
