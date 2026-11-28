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

/**
 * A calendar day, stored as UTC midnight so UTC keeps "Nov 15" from showing as "Nov 14". A record's
 * day names its year; a chart's label, whose axis says the period, leaves it out.
 */
export function formatDay(date: Date, { year = true }: { year?: boolean } = {}): string {
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

/** A date or a time never breaks inside itself: "Nov 18," never ends a line before "2026". */
function keepTogether(text: string): string {
  return text.replaceAll(" ", "\u00A0");
}

export function formatDate(date: Date | string | null | undefined): string {
  return date
    ? keepTogether(new Date(date).toLocaleDateString("en", { dateStyle: "medium" }))
    : "—";
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) {
    return "—";
  }

  const time = new Date(date).toLocaleTimeString("en", { timeStyle: "short" });
  return `${formatDate(date)}, ${keepTogether(time)}`;
}

/** Takes a time of day as "21:00", as reminders store it. */
export function formatTimeOfDay(time: string): string {
  return new Date(`1970-01-01T${time}:00.000Z`).toLocaleTimeString("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function formatPercent(
  value: number | null,
  { decimals = 0 }: { decimals?: number } = {},
): string {
  const factor = 10 ** decimals;
  return value === null ? "—" : `${Math.round(value * factor) / factor}%`;
}

export function formatCount(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString("en")} ${count === 1 ? one : many}`;
}
