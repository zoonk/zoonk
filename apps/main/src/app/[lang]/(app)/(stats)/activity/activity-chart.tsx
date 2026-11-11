import { getAppLocale } from "@/i18n/locale";
import { type LearningActivityDay } from "@zoonk/core/progress/get-learning-activity";
import {
  ContributionCalendar,
  ContributionCalendarCaption,
  ContributionCalendarContent,
  ContributionCalendarDay,
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
import { getFormattingLocale } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { getProgressDayFormatter } from "../_components/progress-insight-date-label";
import { getActivityCalendarIntensity } from "./_utils/activity-calendar-intensity";

const ACTIVITY_CHART_TITLE_ID = "activity-chart-title";

/** Blue means studied, as everywhere in the app. */
const INTENSITY_CLASSES = [
  "bg-surface-3",
  "bg-success/25",
  "bg-success/45",
  "bg-success/70",
  "bg-success",
] as const;

type ActivityCalendarDay = LearningActivityDay & {
  intensityClass: (typeof INTENSITY_CLASSES)[number];
  index: number;
};

type ActivityCalendarWeek = {
  days: ActivityCalendarDay[];
  key: string;
  periodLabel: string | null;
};

function getActivityCalendarDay({
  day,
  index,
  maximumActivitiesCompleted,
}: {
  day: LearningActivityDay;
  index: number;
  maximumActivitiesCompleted: number;
}): ActivityCalendarDay {
  const intensity = getActivityCalendarIntensity({
    activitiesCompleted: day.activitiesCompleted,
    maximumActivitiesCompleted,
  });

  return { ...day, index, intensityClass: INTENSITY_CLASSES.at(intensity) ?? INTENSITY_CLASSES[0] };
}

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

function ActivityCalendarSquare({ day }: { day: ActivityCalendarDay }) {
  return <ContributionCalendarDay className={day.intensityClass} index={day.index} />;
}

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

async function ActivityLegend() {
  const t = await getExtracted("activityLegend");

  return (
    <ContributionCalendarLegend
      aria-label={t({
        description: "Legend of a heatmap, from the lightest to the darkest squares.",
        message: "Activity from less to more",
      })}
    >
      <ContributionCalendarLegendLabel>
        {t({ description: "The light end of a heatmap's legend: less activity.", message: "Less" })}
      </ContributionCalendarLegendLabel>
      {INTENSITY_CLASSES.map((className) => (
        <ContributionCalendarLegendSwatch className={className} key={className} />
      ))}
      <ContributionCalendarLegendLabel>
        {t({ description: "The dark end of a heatmap's legend: more activity.", message: "More" })}
      </ContributionCalendarLegendLabel>
    </ContributionCalendarLegend>
  );
}

/** Dates use DailyProgress's date-only UTC convention, so a stored local date never shifts as it's formatted. */
export async function ActivityChart({ days }: { days: LearningActivityDay[] }) {
  const t = await getExtracted();
  const locale = await getAppLocale();

  const monthFormatter = new Intl.DateTimeFormat(getFormattingLocale(locale), {
    month: "short",
    timeZone: "UTC",
  });

  const formatDay = getProgressDayFormatter({ locale, newest: days.at(-1)?.date });
  const maximumActivitiesCompleted = Math.max(0, ...days.map((day) => day.activitiesCompleted));

  const keyboardStartDate = getContributionCalendarKeyboardStartDate({
    days,
    hasActivity: (day) => day.activitiesCompleted > 0,
  });

  const calendarDays = days.map((day, index) =>
    getActivityCalendarDay({ day, index, maximumActivitiesCompleted }),
  );

  const details = days.map((day) => ({
    label: formatDay(day.date),
    value: t({
      description:
        "A calendar day's value, shown in a small tooltip under the day's date: the activities the learner completed that day.",
      message: "{count, plural, =0 {No study} one {# activity} other {# activities}}",
      values: { count: day.activitiesCompleted },
    }),
  }));

  const startIndex = days.findIndex((day) => day.date.getTime() === keyboardStartDate?.getTime());

  const weeks = groupContributionCalendarDaysByWeek(calendarDays).map((week) =>
    getActivityCalendarWeek({ monthFormatter, week }),
  );

  return (
    <ContributionCalendar
      aria-labelledby={ACTIVITY_CHART_TITLE_ID}
      defaultIndex={Math.max(0, startIndex)}
      details={details}
      weeks={weeks.length}
    >
      <ContributionCalendarCaption>
        <ContributionCalendarTitle id={ACTIVITY_CHART_TITLE_ID}>
          {t("Past 12 months")}
        </ContributionCalendarTitle>
        <ActivityLegend />
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
    </ContributionCalendar>
  );
}

export function ActivityChartSkeleton() {
  return (
    <ContributionCalendar aria-hidden="true">
      <ContributionCalendarCaption>
        <Skeleton className="h-3.5 w-28" />
        <ContributionCalendarLegendSkeleton />
      </ContributionCalendarCaption>
      <ContributionCalendarGridSkeleton />
    </ContributionCalendar>
  );
}
