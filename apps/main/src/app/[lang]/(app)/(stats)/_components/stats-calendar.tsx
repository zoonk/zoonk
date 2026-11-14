import { getAppLocale } from "@/i18n/locale";
import { type ChartPointDetail } from "@zoonk/ui/components/chart-inspector";
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

export type StatsCalendarDay = {
  date: Date;
  /** Whether the day has something to read, so the keyboard starts on the latest such day. */
  hasValue: boolean;
  intensityClass: string;
};

type StatsCalendarLegend = {
  /** The swatches, from the lightest to the darkest. */
  classes: readonly string[];
  high: string;
  label: string;
  low: string;
};

/**
 * The year of days every statistics page draws: one square a day, a legend, and the day's value on
 * hover or with the arrow keys. Dates use DailyProgress's date-only UTC convention, so a stored
 * local date never shifts as it's formatted.
 */
export async function StatsCalendar({
  days,
  details,
  gridLabel,
  legend,
  titleId,
}: {
  days: StatsCalendarDay[];
  /** One per day, in the same order: what the tooltip says. */
  details: ChartPointDetail[];
  gridLabel: string;
  legend: StatsCalendarLegend;
  titleId: string;
}) {
  const t = await getExtracted();
  const locale = await getAppLocale();

  const monthFormatter = new Intl.DateTimeFormat(getFormattingLocale(locale), {
    month: "short",
    timeZone: "UTC",
  });

  const keyboardStartDate = getContributionCalendarKeyboardStartDate({
    days,
    hasActivity: (day) => day.hasValue,
  });

  const startIndex = days.findIndex((day) => day.date.getTime() === keyboardStartDate?.getTime());

  const weeks = groupContributionCalendarDaysByWeek(
    days.map((day, index) => ({ ...day, index })),
  ).map((week) => {
    const monthDate = getContributionCalendarMonthDate(week);

    return {
      days: week,
      key: getContributionCalendarWeekKey(week),
      periodLabel: monthDate ? monthFormatter.format(monthDate) : null,
    };
  });

  return (
    <ContributionCalendar
      aria-labelledby={titleId}
      defaultIndex={Math.max(0, startIndex)}
      details={details}
      weeks={weeks.length}
    >
      <ContributionCalendarCaption>
        <ContributionCalendarTitle id={titleId}>{t("Past 12 months")}</ContributionCalendarTitle>

        <ContributionCalendarLegend aria-label={legend.label}>
          <ContributionCalendarLegendLabel>{legend.low}</ContributionCalendarLegendLabel>
          {legend.classes.map((className) => (
            <ContributionCalendarLegendSwatch className={className} key={className} />
          ))}
          <ContributionCalendarLegendLabel>{legend.high}</ContributionCalendarLegendLabel>
        </ContributionCalendarLegend>
      </ContributionCalendarCaption>

      <ContributionCalendarViewport>
        <ContributionCalendarContent>
          <ContributionCalendarGrid aria-label={gridLabel}>
            {weeks.map((week) => (
              <ContributionCalendarWeek key={week.key}>
                {week.periodLabel && (
                  <ContributionCalendarPeriod>{week.periodLabel}</ContributionCalendarPeriod>
                )}
                {week.days.map((day) => (
                  <ContributionCalendarDay
                    className={day.intensityClass}
                    index={day.index}
                    key={day.date.toISOString()}
                  />
                ))}
              </ContributionCalendarWeek>
            ))}
          </ContributionCalendarGrid>
        </ContributionCalendarContent>
      </ContributionCalendarViewport>
    </ContributionCalendar>
  );
}

export function StatsCalendarSkeleton() {
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
