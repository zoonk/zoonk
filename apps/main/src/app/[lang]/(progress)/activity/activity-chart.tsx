import { type LearningActivityDay } from "@/data/progress/get-learning-activity";
import {
  ContributionCalendar,
  ContributionCalendarCaption,
  ContributionCalendarContent,
  ContributionCalendarDay,
  ContributionCalendarDayContent,
  ContributionCalendarDayIndicator,
  ContributionCalendarDayTrigger,
  ContributionCalendarDescription,
  ContributionCalendarGrid,
  ContributionCalendarGridSkeleton,
  ContributionCalendarLegend,
  ContributionCalendarLegendLabel,
  ContributionCalendarLegendSkeleton,
  ContributionCalendarLegendSwatch,
  ContributionCalendarPeriod,
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
  tabIndex: -1 | 0;
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
  keyboardStartDate,
  maximumLessonCompletions,
}: {
  accessibleLabel: string;
  day: LearningActivityDay;
  keyboardStartDate: Date | null;
  maximumLessonCompletions: number;
}): ActivityCalendarDay {
  const intensity = getActivityCalendarIntensity({
    lessonCompletions: day.lessonCompletions,
    maximumLessonCompletions,
  });

  return {
    ...day,
    accessibleLabel,
    intensityClass: INTENSITY_CLASSES.at(intensity) ?? INTENSITY_CLASSES[0],
    tabIndex: day.date.getTime() === keyboardStartDate?.getTime() ? 0 : -1,
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
  return (
    <ContributionCalendarDay>
      <ContributionCalendarDayTrigger aria-label={day.accessibleLabel} tabIndex={day.tabIndex}>
        <ContributionCalendarDayIndicator className={day.intensityClass} />
      </ContributionCalendarDayTrigger>
      <ContributionCalendarDayContent>{day.accessibleLabel}</ContributionCalendarDayContent>
    </ContributionCalendarDay>
  );
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
 * Activity uses the same date-only UTC convention as DailyProgress so a
 * learner's stored local calendar date never shifts while it is formatted.
 */
export async function ActivityChart({ days }: { days: LearningActivityDay[] }) {
  const t = await getExtracted();
  const locale = await getLocale();
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const shortDateFormatter = getProgressInsightDateFormatter(locale);
  const maximumLessonCompletions = Math.max(0, ...days.map((day) => day.lessonCompletions));

  const keyboardStartDate = getContributionCalendarKeyboardStartDate({
    days,
    hasActivity: (day) => day.lessonCompletions > 0,
  });

  const calendarDays = days.map((day) =>
    getActivityCalendarDay({
      accessibleLabel: t(
        "{count, plural, =0 {# lesson completions on {date}} one {# lesson completion on {date}} other {# lesson completions on {date}}}",
        { count: day.lessonCompletions, date: shortDateFormatter.format(day.date) },
      ),
      day,
      keyboardStartDate,
      maximumLessonCompletions,
    }),
  );

  const weeks = groupContributionCalendarDaysByWeek(calendarDays).map((week) =>
    getActivityCalendarWeek({ monthFormatter, week }),
  );

  return (
    <ContributionCalendar aria-labelledby="activity-chart-title">
      <ContributionCalendarCaption>
        <ContributionCalendarTitle id="activity-chart-title">
          {t("Learning activity")}
        </ContributionCalendarTitle>
        <ContributionCalendarDescription>{t("Past 12 months")}</ContributionCalendarDescription>
      </ContributionCalendarCaption>

      <ContributionCalendarViewport>
        <ContributionCalendarContent>
          <ContributionCalendarGrid>
            {weeks.map((week) => (
              <ActivityCalendarWeekColumn key={week.key} week={week} />
            ))}
          </ContributionCalendarGrid>

          <ContributionCalendarLegend aria-label={t("Lesson activity intensity from less to more")}>
            <ContributionCalendarLegendLabel>{t("Less")}</ContributionCalendarLegendLabel>
            {INTENSITY_CLASSES.map((className) => (
              <ContributionCalendarLegendSwatch className={className} key={className} />
            ))}
            <ContributionCalendarLegendLabel>{t("More")}</ContributionCalendarLegendLabel>
          </ContributionCalendarLegend>
        </ContributionCalendarContent>
      </ContributionCalendarViewport>
    </ContributionCalendar>
  );
}

/**
 * The calendar skeleton reserves the chart's title, grid, and legend height so
 * the rest of the Activity page stays still while private progress data loads.
 */
export function ActivityChartSkeleton() {
  return (
    <ContributionCalendar aria-hidden="true">
      <ContributionCalendarCaption>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24" />
      </ContributionCalendarCaption>
      <ContributionCalendarGridSkeleton />
      <ContributionCalendarLegendSkeleton />
    </ContributionCalendar>
  );
}
