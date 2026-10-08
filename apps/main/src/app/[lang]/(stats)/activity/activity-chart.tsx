import { type LearningActivityDay } from "@zoonk/core/progress/get-learning-activity";
import {
  ContributionCalendar,
  ContributionCalendarCaption,
  ContributionCalendarContent,
  ContributionCalendarDay,
  ContributionCalendarGrid,
  ContributionCalendarGridSkeleton,
  ContributionCalendarPeriod,
  ContributionCalendarReadout,
  ContributionCalendarTitle,
  ContributionCalendarViewport,
  ContributionCalendarWeek,
} from "@zoonk/ui/components/contribution-calendar";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import {
  getContributionCalendarKeyboardStartDate,
  getContributionCalendarMonthDate,
  getContributionCalendarWeekKey,
  groupContributionCalendarDaysByWeek,
} from "@zoonk/utils/contribution-calendar";
import { getExtracted, getLocale } from "next-intl/server";
import { getProgressInsightDateFormatter } from "../_components/progress-insight-date-label";
import { getActivityCalendarIntensity } from "./_utils/activity-calendar-intensity";

const ACTIVITY_CHART_TITLE_ID = "activity-chart-title";

const INTENSITY_CLASSES = [
  "bg-muted",
  "bg-info/20",
  "bg-info/40",
  "bg-info/60",
  "bg-info",
] as const;

type ActivityCalendarDay = LearningActivityDay & {
  accessibleLabel: string;
  intensityClass: (typeof INTENSITY_CLASSES)[number];
  index: number;
};

type ActivityCalendarWeek = {
  days: ActivityCalendarDay[];
  key: string;
  periodLabel: string | null;
};

/**
 * Adds the display-only label and intensity to one stored activity day before
 * rendering, keeping the calendar composition free of metric calculations.
 */
function getActivityCalendarDay({
  accessibleLabel,
  day,
  index,
  maximumActivitiesCompleted,
}: {
  accessibleLabel: string;
  day: LearningActivityDay;
  index: number;
  maximumActivitiesCompleted: number;
}): ActivityCalendarDay {
  const intensity = getActivityCalendarIntensity({
    activitiesCompleted: day.activitiesCompleted,
    maximumActivitiesCompleted,
  });

  return {
    ...day,
    accessibleLabel,
    index,
    intensityClass: INTENSITY_CLASSES.at(intensity) ?? INTENSITY_CLASSES[0],
  };
}

/**
 * Prepares one visual week with a stable key and optional month label so the
 * JSX only needs to describe the generic contribution-calendar composition.
 */
function getActivityCalendarWeek({
  monthFormatter,
  week,
}: {
  monthFormatter: Intl.DateTimeFormat;
  week: ActivityCalendarDay[];
}): ActivityCalendarWeek {
  const monthDate = getContributionCalendarMonthDate(week);

  return {
    days: week,
    key: getContributionCalendarWeekKey(week),
    periodLabel: monthDate ? monthFormatter.format(monthDate) : null,
  };
}

/**
 * Composes one learning-activity square with its caller-owned detail text.
 * Keeping this domain layer separate lets the shared UI component remain
 * reusable for metrics other than completed lessons.
 */
function ActivityCalendarSquare({ day }: { day: ActivityCalendarDay }) {
  return <ContributionCalendarDay className={day.intensityClass} index={day.index} />;
}

/**
 * Renders one calendar column after its dates and optional month label have
 * been prepared, avoiding nested domain logic inside the main chart markup.
 */
function ActivityCalendarWeekColumn({ week }: { week: ActivityCalendarWeek }) {
  return (
    <ContributionCalendarWeek>
      {week.periodLabel && (
        <ContributionCalendarPeriod>{week.periodLabel}</ContributionCalendarPeriod>
      )}
      {week.days.map((day) => (
        <ActivityCalendarSquare day={day} key={day.date.toISOString()} />
      ))}
    </ContributionCalendarWeek>
  );
}

/**
 * The learning days of the past 12 months, lit by how much was finished each day, by the same
 * definition as the study days above it. Dates use the same date-only UTC convention as
 * DailyProgress so a learner's stored local calendar date never shifts while it is formatted.
 */
export async function ActivityChart({ days }: { days: LearningActivityDay[] }) {
  const t = await getExtracted();
  const locale = await getLocale();
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const shortDateFormatter = getProgressInsightDateFormatter(locale);
  const maximumActivitiesCompleted = Math.max(0, ...days.map((day) => day.activitiesCompleted));

  const keyboardStartDate = getContributionCalendarKeyboardStartDate({
    days,
    hasActivity: (day) => day.activitiesCompleted > 0,
  });

  const calendarDays = days.map((day, index) =>
    getActivityCalendarDay({
      accessibleLabel: t(
        "{count, plural, =0 {No study on {date}} one {# activity finished on {date}} other {# activities finished on {date}}}",
        { count: day.activitiesCompleted, date: shortDateFormatter.format(day.date) },
      ),
      day,
      index,
      maximumActivitiesCompleted,
    }),
  );

  const startIndex = days.findIndex((day) => day.date.getTime() === keyboardStartDate?.getTime());

  const weeks = groupContributionCalendarDaysByWeek(calendarDays).map((week) =>
    getActivityCalendarWeek({ monthFormatter, week }),
  );

  return (
    <ContributionCalendar
      aria-labelledby={ACTIVITY_CHART_TITLE_ID}
      defaultIndex={Math.max(0, startIndex)}
      labels={calendarDays.map((day) => day.accessibleLabel)}
    >
      <ContributionCalendarCaption>
        <ContributionCalendarTitle id={ACTIVITY_CHART_TITLE_ID}>
          {t("Past 12 months")}
        </ContributionCalendarTitle>
      </ContributionCalendarCaption>

      <ContributionCalendarViewport>
        <ContributionCalendarContent>
          <ContributionCalendarGrid aria-label={t("Activity by day")}>
            {weeks.map((week) => (
              <ActivityCalendarWeekColumn key={week.key} week={week} />
            ))}
          </ContributionCalendarGrid>
        </ContributionCalendarContent>
      </ContributionCalendarViewport>

      <ContributionCalendarReadout />
    </ContributionCalendar>
  );
}

/**
 * The calendar skeleton reserves the chart's title and grid height so the rest
 * of the Activity page stays still while private progress data loads.
 */
export function ActivityChartSkeleton() {
  return (
    <ContributionCalendar aria-hidden="true">
      <ContributionCalendarCaption>
        <Skeleton className="h-5 w-32" />
      </ContributionCalendarCaption>
      <ContributionCalendarGridSkeleton />
    </ContributionCalendar>
  );
}
