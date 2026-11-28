import { MS_PER_DAY } from "@zoonk/utils/date";
import { isInAnotherYear } from "./calendar-day";
import { getFormattingLocale } from "./locale";

/**
 * Where a date sits decides how it's written, so a screen asks by role and every screen writes it
 * one way: a data row or a facts line ("Nov 14"), a sentence ("November 14"), a month in either
 * ("Jan", "January"), a year alone ("2031"), or a weekday's name.
 */
export type DateRole = "row" | "rowMonth" | "sentence" | "sentenceMonth" | "weekday" | "year";

export type DateFormat = {
  role?: DateRole;
  /** The day's weekday before it: "Tue, Nov 17" in a row, "Tuesday, November 17" in a sentence. */
  weekday?: boolean;
  /** Left out, a date carries its year only in another calendar year than today's. */
  year?: "always" | "never";
};

/** Narrower than `Intl.DateTimeFormatOptions`, so next-intl's formatter takes it too. */
type IsoDateOptions = {
  day?: "numeric";
  month?: "long" | "short";
  timeZone: "UTC";
  weekday?: "long" | "short";
  year?: "numeric";
};

const ROLE_OPTIONS: Record<DateRole, Omit<IsoDateOptions, "timeZone">> = {
  row: { day: "numeric", month: "short" },
  rowMonth: { month: "short" },
  sentence: { day: "numeric", month: "long" },
  sentenceMonth: { month: "long" },
  weekday: { weekday: "long" },
  year: { year: "numeric" },
};

const ROW_ROLES = new Set<DateRole>(["row", "rowMonth"]);

function showsYear({
  isoDate,
  role,
  today,
  year,
}: {
  isoDate: string;
  role: DateRole;
  today: string;
  year: DateFormat["year"];
}): boolean {
  if (role === "weekday" || year === "never") {
    return false;
  }

  return year === "always" || isInAnotherYear({ isoDate, today });
}

/** A calendar day ("2027-11-14") is drawn at UTC midnight, so no viewer's zone moves it. */
export function getIsoDateOptions({
  isoDate,
  role = "row",
  today,
  weekday = false,
  year,
}: DateFormat & { isoDate: string; today: string }): IsoDateOptions {
  return {
    ...ROLE_OPTIONS[role],
    ...(weekday && { weekday: ROW_ROLES.has(role) ? ("short" as const) : ("long" as const) }),
    ...(showsYear({ isoDate, role, today, year }) && { year: "numeric" as const }),
    timeZone: "UTC",
  };
}

/** A range of calendar days, such as a week: both ends carry the year when either is in another year. */
export function getIsoRangeOptions({
  end,
  start,
  today,
  year,
}: {
  end: string;
  start: string;
  today: string;
  year?: "always";
}): IsoDateOptions {
  const withYear =
    year === "always" || [start, end].some((isoDate) => isInAnotherYear({ isoDate, today }));

  return { ...ROLE_OPTIONS.row, timeZone: "UTC", ...(withYear && { year: "numeric" as const }) };
}

export function isoDateToUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

export function formatIsoDate({
  locale,
  ...date
}: DateFormat & { isoDate: string; locale: string; today: string }): string {
  return new Intl.DateTimeFormat(getFormattingLocale(locale), getIsoDateOptions(date)).format(
    isoDateToUtc(date.isoDate),
  );
}

export function formatIsoDateRange({
  locale,
  ...range
}: {
  end: string;
  locale: string;
  start: string;
  today: string;
  year?: "always";
}): string {
  return new Intl.DateTimeFormat(
    getFormattingLocale(locale),
    getIsoRangeOptions(range),
  ).formatRange(isoDateToUtc(range.start), isoDateToUtc(range.end));
}

/** The same date in its parts, for a screen that sets one of them apart (a big month, a small year). */
export function getIsoDateParts({
  locale,
  ...date
}: DateFormat & { isoDate: string; locale: string; today: string }): Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat(
    getFormattingLocale(locale),
    getIsoDateOptions(date),
  ).formatToParts(isoDateToUtc(date.isoDate));
}

/**
 * A month and its year for a screen that sets the year apart, in the language's order: the year as
 * the language writes it alone ("2026", "2026년", "2026年") and the gap beside it are the small part.
 */
export function getMonthYearParts({
  isoDate,
  locale,
}: {
  isoDate: string;
  locale: string;
}): { small: boolean; text: string }[] {
  const text = formatIsoDate({ isoDate, locale, role: "rowMonth", today: isoDate, year: "always" });
  const year = formatIsoDate({ isoDate, locale, role: "year", today: isoDate });
  const at = text.indexOf(year);

  if (at === -1) {
    return [{ small: false, text }];
  }

  const month = text.slice(0, at).trimEnd();
  const rest = text.slice(at + year.length).trimStart();

  return [
    { small: false, text: month },
    { small: true, text: text.slice(month.length, text.length - rest.length) },
    { small: false, text: rest },
  ].filter((part) => part.text !== "");
}

const REFERENCE_SUNDAY = Date.parse("2023-01-01T00:00:00Z");

/** A weekday's name from its number, Sunday 0: "Tuesday" or "Tue". */
export function formatWeekdayName({
  locale,
  weekday,
  width = "long",
}: {
  locale: string;
  weekday: number;
  width?: "long" | "short";
}): string {
  return new Intl.DateTimeFormat(getFormattingLocale(locale), {
    timeZone: "UTC",
    weekday: width,
  }).format(new Date(REFERENCE_SUNDAY + weekday * MS_PER_DAY));
}

/** A clock hour in the language's own cycle ("6 AM", "06"), read in UTC so no server zone moves it. */
export function getHourFormatter(locale: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getFormattingLocale(locale), { hour: "numeric", timeZone: "UTC" });
}
