/**
 * Admin tables use compact English dates because the surrounding column
 * already says what the date means. Missing dates render as a dash.
 */
export function formatDate(date: Date | string | null | undefined): string {
  return date ? new Date(date).toLocaleDateString("en") : "—";
}

/** Detail pages show the time too, so admins can match rows to workflow logs. */
export function formatDateTime(date: Date | string | null | undefined): string {
  return date
    ? new Date(date).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })
    : "—";
}

const PERCENT_DIGITS = 1;

/** Rates in admin tables share one precision so columns line up. */
export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(PERCENT_DIGITS)}%`;
}
