/**
 * Progress insight cards have compact layouts, so their winning-day labels use
 * the locale's short numeric date instead of spelling out the month and year.
 */
export function getProgressInsightDateLabel({ date, locale }: { date: Date; locale: string }) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeZone: "UTC" }).format(date);
}
