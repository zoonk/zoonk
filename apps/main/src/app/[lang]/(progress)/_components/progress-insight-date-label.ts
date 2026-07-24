/**
 * Creates one formatter that preserves persisted UTC date-only values. Charts
 * can reuse the instance across hundreds of days instead of rebuilding the same
 * locale rules for every square.
 */
export function getProgressInsightDateFormatter(locale: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeZone: "UTC" });
}
