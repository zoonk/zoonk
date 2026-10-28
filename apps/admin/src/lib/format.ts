export function formatDate(date: Date | string | null | undefined): string {
  return date ? new Date(date).toLocaleDateString("en") : "—";
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
