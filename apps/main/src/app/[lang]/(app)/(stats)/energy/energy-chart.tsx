import { type EnergyDay } from "@zoonk/core/progress/energy";
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
import { formatMetricPercent } from "@zoonk/utils/number";
import { getExtracted, getFormatter, getLocale } from "next-intl/server";
import { getProgressDayFormatter } from "../_components/progress-insight-date-label";
import { getEnergyCalendarIntensity } from "./_utils/energy-calendar-intensity";

const ENERGY_HISTORY_TITLE_ID = "energy-history-title";

const ENERGY_INTENSITY_CLASSES = [
  "bg-surface-3",
  "bg-energy/20",
  "bg-energy/40",
  "bg-energy/60",
  "bg-energy/80",
  "bg-energy",
] as const;

type EnergyCalendarDay = EnergyDay & {
  accessibleLabel: string;
  intensityClass: (typeof ENERGY_INTENSITY_CLASSES)[number];
  index: number;
};

type EnergyCalendarWeek = { days: EnergyCalendarDay[]; key: string; periodLabel: string | null };

/**
 * Adds Energy's readout sentence, intensity and place in the days' order before the generic
 * contribution-calendar primitives render the day.
 */
function getEnergyCalendarDay({
  accessibleLabel,
  day,
  index,
}: {
  accessibleLabel: string;
  day: EnergyDay;
  index: number;
}): EnergyCalendarDay {
  const intensityClass =
    ENERGY_INTENSITY_CLASSES.at(getEnergyCalendarIntensity(day.energy)) ??
    ENERGY_INTENSITY_CLASSES[0];

  return { ...day, accessibleLabel, index, intensityClass };
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

/** One Energy square in its shade; the calendar reads its sentence out when it is picked. */
function EnergyCalendarSquare({ day }: { day: EnergyCalendarDay }) {
  return <ContributionCalendarDay className={day.intensityClass} index={day.index} />;
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

/** "Low ■■■■■■ High": the shades from no Energy to full. */
async function EnergyLegend() {
  const t = await getExtracted();

  return (
    <ContributionCalendarLegend aria-label={t("Energy intensity from low to high")}>
      <ContributionCalendarLegendLabel>{t("Low")}</ContributionCalendarLegendLabel>
      {ENERGY_INTENSITY_CLASSES.map((className) => (
        <ContributionCalendarLegendSwatch className={className} key={className} />
      ))}
      <ContributionCalendarLegendLabel>{t("High")}</ContributionCalendarLegendLabel>
    </ContributionCalendarLegend>
  );
}

/**
 * Energy over the past 12 months in its amber, the key to its shades on the title row. Energy
 * dates use the same date-only UTC convention as DailyProgress, keeping learner-local calendar
 * dates stable while labels are localized.
 */
export async function EnergyChart({ days }: { days: EnergyDay[] }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const locale = await getLocale();

  const keyboardStartDate = getContributionCalendarKeyboardStartDate({
    days,
    hasActivity: (day) => day.energy !== null,
  });

  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const formatDay = getProgressDayFormatter({ locale, newest: days.at(-1)?.date });

  function getAccessibleLabel(day: EnergyDay) {
    const date = formatDay(day.date);

    if (day.energy === null) {
      return t("{date} · No Energy recorded", { date });
    }

    return t("{date} · {percentage} Energy", {
      date,
      percentage: formatMetricPercent({ format, value: day.energy }),
    });
  }

  const calendarDays = days.map((day, index) =>
    getEnergyCalendarDay({ accessibleLabel: getAccessibleLabel(day), day, index }),
  );

  const startIndex = days.findIndex((day) => day.date.getTime() === keyboardStartDate?.getTime());

  const weeks = groupContributionCalendarDaysByWeek(calendarDays).map((week) =>
    getEnergyCalendarWeek({ monthFormatter, week }),
  );

  return (
    <ContributionCalendar
      aria-labelledby={ENERGY_HISTORY_TITLE_ID}
      defaultIndex={Math.max(0, startIndex)}
      labels={calendarDays.map((day) => day.accessibleLabel)}
      weeks={weeks.length}
    >
      <ContributionCalendarCaption>
        <ContributionCalendarTitle id={ENERGY_HISTORY_TITLE_ID}>
          {t("Past 12 months")}
        </ContributionCalendarTitle>
        <EnergyLegend />
      </ContributionCalendarCaption>

      <ContributionCalendarViewport>
        <ContributionCalendarContent>
          <ContributionCalendarGrid aria-label={t("Energy by day")}>
            {weeks.map((week) => (
              <EnergyCalendarWeekColumn key={week.key} week={week} />
            ))}
          </ContributionCalendarGrid>
        </ContributionCalendarContent>
      </ContributionCalendarViewport>

      <ContributionCalendarReadout />
    </ContributionCalendar>
  );
}

/**
 * The calendar at its size while Energy's history streams: its title row with the key, the grid
 * and the readout's line.
 */
export function EnergyChartSkeleton() {
  return (
    <ContributionCalendar aria-hidden="true">
      <ContributionCalendarCaption>
        <Skeleton className="h-3.5 w-28" />
        <ContributionCalendarLegendSkeleton />
      </ContributionCalendarCaption>
      <ContributionCalendarGridSkeleton />
      <Skeleton className="h-5 w-40" />
    </ContributionCalendar>
  );
}
