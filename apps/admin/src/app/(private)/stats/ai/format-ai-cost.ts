import { parseLocalDate } from "@zoonk/utils/date";

/**
 * AI Gateway costs are often far below one cent, so the default 2-decimal USD
 * formatter hides the signal we care about. This formatter preserves enough
 * precision to make small per-request costs readable in the admin tables.
 */
export function formatAiCost(value: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 6,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

/**
 * The task detail page shows date filters as `YYYY-MM-DD` values but the summary
 * copy should read like a normal report range for admins scanning the page.
 */
export function formatAiStatsDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(parseLocalDate(value));
}
