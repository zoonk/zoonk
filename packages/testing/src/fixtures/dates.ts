const MID_MONTH_DAY = 15;

/**
 * Creates a date safely in the middle of a month to avoid edge cases.
 * Using day 15 prevents issues when subtracting months (e.g., March 31 - 1 month
 * would roll over since Feb 31 doesn't exist).
 * @param monthsAgo - Number of months to subtract from current month
 * @param daysOffset - Additional days to subtract (max 10 to stay within same month)
 */
export function createSafeDate(monthsAgo = 0, daysOffset = 0): Date {
  const date = new Date();
  date.setDate(MID_MONTH_DAY - daysOffset);
  date.setMonth(date.getMonth() - monthsAgo);
  return date;
}
