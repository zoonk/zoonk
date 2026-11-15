import { formatIsoDate, formatIsoDateRange } from "@zoonk/utils/date-format";

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** A stored code in words: `welcomeBack` and `multiple_choice` read "Welcome back" and "Multiple choice". */
export function toWords(code: string): string {
  return capitalize(
    code
      .replaceAll(/(?<lower>[a-z\d])(?<upper>[A-Z])/gu, "$<lower> $<upper>")
      .replaceAll(/[_-]+/gu, " ")
      .toLowerCase(),
  );
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, "YYYY-MM-DD".length);
}

/** A calendar day, stored as UTC midnight so UTC keeps "Nov 15" from showing as "Nov 14". */
export function formatDay(date: Date, { year = false }: { year?: boolean } = {}): string {
  const isoDate = toIsoDay(date);

  return formatIsoDate({ isoDate, locale: "en", today: isoDate, year: year ? "always" : "never" });
}

/** A calendar month alone, as a chart's or a calendar's label: "Nov". */
export function formatMonth(date: Date): string {
  const isoDate = toIsoDay(date);
  return formatIsoDate({ isoDate, locale: "en", role: "rowMonth", today: isoDate });
}

export function formatDayRange({ end, start }: { end: Date; start: Date }): string {
  return formatIsoDateRange({
    end: toIsoDay(end),
    locale: "en",
    start: toIsoDay(start),
    today: toIsoDay(start),
    year: "always",
  });
}

/** An instant's day in the server's zone, with no year: "Nov 15". */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en", { day: "numeric", month: "short" });
}

export function formatDate(date: Date | string | null | undefined): string {
  return date ? new Date(date).toLocaleDateString("en", { dateStyle: "medium" }) : "—";
}

export function formatDateTime(date: Date | string | null | undefined): string {
  return date
    ? new Date(date).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })
    : "—";
}

const PERCENT_DIGITS = 1;

export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(PERCENT_DIGITS)}%`;
}

export function formatCount(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString("en")} ${count === 1 ? one : many}`;
}
