const MID_MONTH_DAY = 15;
const SUNDAY_TO_MONDAY_OFFSET = -6;

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

/**
 * Creates two dates guaranteed to be in the same week (Monday-Sunday).
 * Useful for testing weekly aggregation without flakiness.
 * @param daysBetween - Number of days between the two dates (max 6)
 * @returns Tuple of [earlierDate, laterDate] in the same week
 */
export function createSameWeekDates(daysBetween = 2): [Date, Date] {
  const baseDate = createSafeDate(0);
  const day = baseDate.getDay();
  const diff = baseDate.getDate() - day + (day === 0 ? SUNDAY_TO_MONDAY_OFFSET : 1);

  const monday = new Date(baseDate);
  monday.setDate(diff);
  monday.setHours(12, 0, 0, 0);

  // Use Tuesday and Thursday (or other days based on daysBetween)
  // to ensure both dates are within the same Mon-Sun week
  const day1 = new Date(monday);
  day1.setDate(monday.getDate() + 1); // Tuesday

  const day2 = new Date(monday);
  day2.setDate(monday.getDate() + 1 + daysBetween); // Tuesday + daysBetween

  return [day1, day2];
}
