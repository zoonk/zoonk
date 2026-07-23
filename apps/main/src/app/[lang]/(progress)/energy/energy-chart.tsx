import { type EnergyHistoryDay } from "@/data/progress/get-energy-history";
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
import { formatMetricPercent } from "@zoonk/utils/number";
import { getExtracted, getFormatter, getLocale } from "next-intl/server";
import { getProgressInsightDateFormatter } from "../_components/progress-insight-date-label";
import { getEnergyCalendarIntensity } from "./_utils/energy-calendar-intensity";

const ENERGY_INTENSITY_CLASSES = [
  "bg-muted",
  "bg-energy/20",
  "bg-energy/40",
  "bg-energy/60",
  "bg-energy/80",
  "bg-energy",
] as const;

type EnergyCalendarDay = EnergyHistoryDay & {
  accessibleLabel: string;
  intensityClass: (typeof ENERGY_INTENSITY_CLASSES)[number];
  tabIndex: -1 | 0;
};

type EnergyCalendarWeek = { days: EnergyCalendarDay[]; key: string; periodLabel: string | null };

/**
 * Adds Energy's display-only tooltip, intensity, and keyboard state before the
 * generic contribution-calendar primitives render the day.
 */
function getEnergyCalendarDay({
  accessibleLabel,
  day,
  keyboardStartDate,
}: {
  accessibleLabel: string;
  day: EnergyHistoryDay;
  keyboardStartDate: Date | null;
}): EnergyCalendarDay {
  const intensityClass =
    ENERGY_INTENSITY_CLASSES.at(getEnergyCalendarIntensity(day.energy)) ??
    ENERGY_INTENSITY_CLASSES[0];

  return {
    ...day,
    accessibleLabel,
    intensityClass,
    tabIndex: day.date.getTime() === keyboardStartDate?.getTime() ? 0 : -1,
  };
}

/**
 * Prepares one Energy week with an optional month label so the main JSX remains
 * a direct composition of the reusable calendar building blocks.
 */
function getEnergyCalendarWeek({
  monthFormatter,
  week,
}: {
  monthFormatter: Intl.DateTimeFormat;
  week: EnergyCalendarDay[];
}): EnergyCalendarWeek {
  const monthDate = getContributionCalendarMonthDate(week);

  return {
    days: week,
    key: getContributionCalendarWeekKey(week),
    periodLabel: monthDate ? monthFormatter.format(monthDate) : null,
  };
}

/** Composes one Energy square with its hover, focus, and tap detail. */
function EnergyCalendarSquare({ day }: { day: EnergyCalendarDay }) {
  return (
    <ContributionCalendarDay>
      <ContributionCalendarDayTrigger aria-label={day.accessibleLabel} tabIndex={day.tabIndex}>
        <ContributionCalendarDayIndicator className={day.intensityClass} />
      </ContributionCalendarDayTrigger>
      <ContributionCalendarDayContent>{day.accessibleLabel}</ContributionCalendarDayContent>
    </ContributionCalendarDay>
  );
}

/** Renders one seven-day Energy column and its optional month label. */
function EnergyCalendarWeekColumn({ week }: { week: EnergyCalendarWeek }) {
  return (
    <ContributionCalendarWeek>
      {week.periodLabel && (
        <ContributionCalendarPeriod>{week.periodLabel}</ContributionCalendarPeriod>
      )}
      {week.days.map((day) => (
        <EnergyCalendarSquare day={day} key={day.date.toISOString()} />
      ))}
    </ContributionCalendarWeek>
  );
}

/**
 * Energy dates use the same date-only UTC convention as DailyProgress, keeping
 * learner-local calendar dates stable while labels are localized.
 */
export async function EnergyChart({ days }: { days: EnergyHistoryDay[] }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const locale = await getLocale();

  const keyboardStartDate = getContributionCalendarKeyboardStartDate({
    days,
    hasActivity: (day) => day.energy !== null,
  });

  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const shortDateFormatter = getProgressInsightDateFormatter(locale);

  const calendarDays = days.map((day) => {
    const date = shortDateFormatter.format(day.date);

    const accessibleLabel =
      day.energy === null
        ? t("No Energy recorded on {date}", { date })
        : t("{percentage} Energy on {date}", {
            date,
            percentage: formatMetricPercent({ format, value: day.energy }),
          });

    return getEnergyCalendarDay({ accessibleLabel, day, keyboardStartDate });
  });

  const weeks = groupContributionCalendarDaysByWeek(calendarDays).map((week) =>
    getEnergyCalendarWeek({ monthFormatter, week }),
  );

  return (
    <ContributionCalendar aria-labelledby="energy-history-title">
      <ContributionCalendarCaption>
        <ContributionCalendarTitle id="energy-history-title">
          {t("Energy history")}
        </ContributionCalendarTitle>
        <ContributionCalendarDescription>{t("Past 12 months")}</ContributionCalendarDescription>
      </ContributionCalendarCaption>

      <ContributionCalendarViewport>
        <ContributionCalendarContent>
          <ContributionCalendarGrid>
            {weeks.map((week) => (
              <EnergyCalendarWeekColumn key={week.key} week={week} />
            ))}
          </ContributionCalendarGrid>

          <ContributionCalendarLegend aria-label={t("Energy intensity from low to high")}>
            <ContributionCalendarLegendLabel>{t("Low")}</ContributionCalendarLegendLabel>
            {ENERGY_INTENSITY_CLASSES.map((className) => (
              <ContributionCalendarLegendSwatch className={className} key={className} />
            ))}
            <ContributionCalendarLegendLabel>{t("High")}</ContributionCalendarLegendLabel>
          </ContributionCalendarLegend>
        </ContributionCalendarContent>
      </ContributionCalendarViewport>
    </ContributionCalendar>
  );
}

/**
 * The Energy calendar skeleton reserves the final title, grid, and legend
 * height while private history data streams.
 */
export function EnergyChartSkeleton() {
  return (
    <ContributionCalendar aria-hidden="true">
      <ContributionCalendarCaption>
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-24" />
      </ContributionCalendarCaption>
      <ContributionCalendarGridSkeleton />
      <ContributionCalendarLegendSkeleton />
    </ContributionCalendar>
  );
}
