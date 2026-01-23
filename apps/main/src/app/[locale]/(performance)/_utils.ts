import type { HistoryPeriod } from "@/data/progress/_utils";

export function formatPeriodLabel(
  periodStart: Date,
  periodEnd: Date,
  period: HistoryPeriod,
  locale: string,
): string {
  if (period === "month") {
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(periodStart);
  }

  if (period === "6months") {
    const startMonth = new Intl.DateTimeFormat(locale, {
      month: "short",
    }).format(periodStart);

    const endMonth = new Intl.DateTimeFormat(locale, { month: "short" }).format(periodEnd);

    const year = periodStart.getFullYear();

    return `${startMonth} - ${endMonth} ${year}`;
  }

  return String(periodStart.getFullYear());
}
