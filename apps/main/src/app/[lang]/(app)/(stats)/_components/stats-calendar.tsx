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
  CONTRIBUTION_CALENDAR_DAYS_PER_WEEK,
  getContributionCalendarKeyboardStartDate,
  getContributionCalendarMonthDate,
  getContributionCalendarWeekKey,
  groupContributionCalendarDaysByWeek,
} from "@zoonk/utils/contribution-calendar";
import { formatIsoDate, formatWeekdayName } from "@zoonk/utils/date-format";
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
  /** What a darker square means, as in "Study time". */
  title: string;
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

  const formatMonth = (month: Date) => {
    const isoDate = month.toISOString().slice(0, "YYYY-MM-DD".length);
    return formatIsoDate({ isoDate, locale, role: "rowMonth", today: isoDate });
  };

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
      periodLabel: monthDate ? formatMonth(monthDate) : null,
    };
  });

  const weekdays = Array.from({ length: CONTRIBUTION_CALENDAR_DAYS_PER_WEEK }, (_, weekday) => ({
    label: weekday % 2 === 1 ? formatWeekdayName({ locale, weekday, width: "short" }) : "",
    weekday,
  }));

  const weekNodes = weeks.map((week) => (
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
  ));

  return (
    <ContributionCalendar
      aria-labelledby={titleId}
      defaultIndex={Math.max(0, startIndex)}
      details={details}
      recentOnPhone
      weeks={weeks.length}
    >
      <ContributionCalendarCaption>
        <ContributionCalendarTitle id={titleId}>
          <span className="max-sm:hidden">{t("Past 12 months")}</span>
          <span className="sm:hidden">
            {t({
              description:
                "Title over a calendar of days on a phone, which shows only its last 26 weeks.",
              message: "Past 6 months",
            })}
          </span>
        </ContributionCalendarTitle>

        <ContributionCalendarLegend aria-label={legend.label}>
          <ContributionCalendarLegendLabel className="me-1">
            {legend.title}
          </ContributionCalendarLegendLabel>
          <ContributionCalendarLegendLabel>{legend.low}</ContributionCalendarLegendLabel>
          {legend.classes.map((className) => (
            <ContributionCalendarLegendSwatch className={className} key={className} />
          ))}
          <ContributionCalendarLegendLabel>{legend.high}</ContributionCalendarLegendLabel>
        </ContributionCalendarLegend>
      </ContributionCalendarCaption>

      <StatsCalendarBody weekdays={weekdays}>
        <ContributionCalendarViewport>
          <ContributionCalendarContent>
            <ContributionCalendarGrid aria-label={gridLabel}>{weekNodes}</ContributionCalendarGrid>
          </ContributionCalendarContent>
        </ContributionCalendarViewport>
      </StatsCalendarBody>
    </ContributionCalendar>
  );
}

/**
 * Weeks start on Sunday, so Monday, Wednesday and Friday are named, as calendars of days usually do.
 * The days fit the width the weekday column leaves, the same while loading and loaded.
 */
function StatsCalendarBody({
  children,
  weekdays,
}: {
  children: React.ReactNode;
  weekdays?: { label: string; weekday: number }[];
}) {
  return (
    <div className="flex min-w-0 gap-2">
      <div
        aria-hidden="true"
        className="text-faint text-2xs grid w-7 shrink-0 grid-rows-7 items-center pt-5 pb-1 font-mono leading-none"
      >
        {weekdays?.map((day) => (
          <span key={day.weekday}>{day.label}</span>
        ))}
      </div>

      <div className="@container/calendar min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function StatsCalendarSkeleton() {
  return (
    <ContributionCalendar aria-hidden="true">
      <ContributionCalendarCaption>
        <Skeleton className="h-3.5 w-28" />
        <ContributionCalendarLegendSkeleton />
      </ContributionCalendarCaption>
      <StatsCalendarBody>
        <ContributionCalendarGridSkeleton />
      </StatsCalendarBody>
    </ContributionCalendar>
  );
}
