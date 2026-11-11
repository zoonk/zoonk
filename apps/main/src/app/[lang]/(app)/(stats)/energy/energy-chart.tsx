import { getAppLocale } from "@/i18n/locale";
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
import { formatMetricPercent } from "@zoonk/utils/number";
import { getExtracted, getFormatter } from "next-intl/server";
import { getProgressDayFormatter } from "../_components/progress-insight-date-label";
import { getEnergyCalendarIntensity } from "./_utils/energy-calendar-intensity";

const ENERGY_HISTORY_TITLE_ID = "energy-history-title";

/** Softened: most days sit in the upper steps, and at full strength the calendar was the loudest thing on the page. */
const ENERGY_INTENSITY_CLASSES = [
  "bg-surface-3",
  "bg-energy/15",
  "bg-energy/30",
  "bg-energy/45",
  "bg-energy/60",
  "bg-energy/80",
] as const;

type EnergyCalendarDay = EnergyDay & {
  intensityClass: (typeof ENERGY_INTENSITY_CLASSES)[number];
  index: number;
};

type EnergyCalendarWeek = { days: EnergyCalendarDay[]; key: string; periodLabel: string | null };

function getEnergyCalendarDay({
  day,
  index,
}: {
  day: EnergyDay;
  index: number;
}): EnergyCalendarDay {
  const intensityClass =
    ENERGY_INTENSITY_CLASSES.at(getEnergyCalendarIntensity(day.energy)) ??
    ENERGY_INTENSITY_CLASSES[0];

  return { ...day, index, intensityClass };
}

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

function EnergyCalendarSquare({ day }: { day: EnergyCalendarDay }) {
  return <ContributionCalendarDay className={day.intensityClass} index={day.index} />;
}

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

/** Dates use DailyProgress's date-only UTC convention, so a stored local date never shifts as it's formatted. */
export async function EnergyChart({ days }: { days: EnergyDay[] }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const locale = await getAppLocale();

  const keyboardStartDate = getContributionCalendarKeyboardStartDate({
    days,
    hasActivity: (day) => day.energy !== null,
  });

  const monthFormatter = new Intl.DateTimeFormat(getFormattingLocale(locale), {
    month: "short",
    timeZone: "UTC",
  });

  const formatDay = getProgressDayFormatter({ locale, newest: days.at(-1)?.date });

  const calendarDays = days.map((day, index) => getEnergyCalendarDay({ day, index }));

  const details = days.map((day) => ({
    label: formatDay(day.date),
    value:
      day.energy === null
        ? t({
            description:
              "A calendar day's value, shown in a small tooltip under the day's date, for a day without an Energy value.",
            message: "No Energy recorded",
          })
        : t({
            description:
              "A calendar day's value, shown in a small tooltip under the day's date: the buddy's Energy that day, such as “72% Energy”.",
            message: "{percentage} Energy",
            values: { percentage: formatMetricPercent({ format, value: day.energy }) },
          }),
  }));

  const startIndex = days.findIndex((day) => day.date.getTime() === keyboardStartDate?.getTime());

  const weeks = groupContributionCalendarDaysByWeek(calendarDays).map((week) =>
    getEnergyCalendarWeek({ monthFormatter, week }),
  );

  return (
    <ContributionCalendar
      aria-labelledby={ENERGY_HISTORY_TITLE_ID}
      defaultIndex={Math.max(0, startIndex)}
      details={details}
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
    </ContributionCalendar>
  );
}

export function EnergyChartSkeleton() {
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
