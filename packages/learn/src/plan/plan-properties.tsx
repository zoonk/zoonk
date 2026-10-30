"use client";

import { LANGUAGE_ACTIVITY_TYPES } from "@zoonk/core/language/activities";
import { type MockScheduleView } from "@zoonk/core/plans/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { PlusMark } from "../_components/plus-lock";
import { useFormatDuration } from "../_utils/time-format";
import { useFormatWeekday } from "../_utils/use-format-weekday";
import { LearnLink } from "../learn-link";
import { useActivityName } from "./plan-activities";
import { usePlanScreen } from "./plan-context";
import { PlanDateText } from "./plan-date-text";
import { type PlanEditorSection } from "./plan-editor-sections";

const TITLE_ID = "plan-properties-title";
const DAYS_PER_WEEK = 7;

const MONDAY_FIRST: readonly number[] = Array.from(
  { length: DAYS_PER_WEEK },
  (_, index) => (index + 1) % DAYS_PER_WEEK,
);

const MIN_RANGE_DAYS = 3;

function isOneRun(days: readonly number[]): boolean {
  const positions = days.map((day) => MONDAY_FIRST.indexOf(day));

  return positions.every(
    (position, index) => index === 0 || position === (positions[index - 1] ?? 0) + 1,
  );
}

function useStudyDaysText() {
  const t = useExtracted();
  const formatWeekday = useFormatWeekday();

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
      return t("{first} – {last}", {
        first: formatWeekday(first, "short"),
        last: formatWeekday(last, "short"),
      });
    }

    return days.map((day) => formatWeekday(day, "short")).join(", ");
  };
}

function mono(chunks: React.ReactNode) {
  return <span className="font-mono tabular-nums">{chunks}</span>;
}

function DailyTimeValue() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { plan } = usePlanScreen();
  const { shape } = plan.schedule;

  if (shape.weekend === null) {
    return mono(formatDuration(shape.weekdays));
  }

  return t.rich("<mono>{weekdays}</mono> · <mono>{weekend}</mono> weekends", {
    mono,
    weekdays: formatDuration(shape.weekdays),
    weekend: formatDuration(shape.weekend),
  });
}

const PROPERTY_ROW_CLASS =
  "hover:bg-muted focus-visible:ring-ring/50 -mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-md px-2 text-left text-[0.8125rem] transition-colors outline-none focus-visible:ring-[3px]";

function PropertyRowParts({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <>
      <span className="text-muted-foreground max-w-[60%] shrink-0 truncate">{label}</span>
      <span className="line-clamp-2 min-w-0 py-1 text-right text-balance">{children}</span>
    </>
  );
}

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

const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

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

/** Mock exams aren't a setting, so the row opens the exam's page, where they are. */
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
