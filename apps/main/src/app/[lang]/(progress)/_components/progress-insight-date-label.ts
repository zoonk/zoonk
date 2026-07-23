/**
 * Creates one formatter that preserves persisted UTC date-only values. Charts
 * can reuse the instance across hundreds of days instead of rebuilding the same
 * locale rules for every square.
 */
export function getProgressInsightDateFormatter(locale: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeZone: "UTC" });
}

/**
 * Progress insight cards only render one winning day, so this convenience
 * helper keeps their short-date formatting aligned with the calendar charts.
 */
export function getProgressInsightDateLabel({ date, locale }: { date: Date; locale: string }) {
  return getProgressInsightDateFormatter(locale).format(date);
}
