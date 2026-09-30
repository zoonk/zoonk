import { getFormatter } from "next-intl/server";

/**
 * The example plan on the home page (the move abroad in `example-move.ts`)
 * uses fixed dates, shown as a short day and month in the page's language.
 */
const EXAMPLE_DATES = {
  bossDuel: "2026-11-15T12:00:00Z",
  dailyLife: "2027-01-11T12:00:00Z",
  movingDay: "2027-03-02T12:00:00Z",
  workPhase: "2026-11-16T12:00:00Z",
} as const;

export type ExampleDate = keyof typeof EXAMPLE_DATES;

export async function getExampleDates(): Promise<Record<ExampleDate, string>> {
  const format = await getFormatter();

  const formatDay = (date: string) =>
    format.dateTime(new Date(date), { day: "numeric", month: "short", timeZone: "UTC" });

  return {
    bossDuel: formatDay(EXAMPLE_DATES.bossDuel),
    dailyLife: formatDay(EXAMPLE_DATES.dailyLife),
    movingDay: formatDay(EXAMPLE_DATES.movingDay),
    workPhase: formatDay(EXAMPLE_DATES.workPhase),
  };
}
