export type RateTrendRow = { date: Date; denominator: bigint; numerator: bigint };

/**
 * Converts the numerator and denominator returned by one grouped database row
 * into the common trend-point shape used by admin charts. Calculating the rate
 * after aggregation keeps large and small activity days weighted correctly.
 */
export function toRateTrendPoint(row: RateTrendRow) {
  const denominator = Number(row.denominator);
  const numerator = Number(row.numerator);

  return { count: denominator === 0 ? 0 : (numerator / denominator) * 100, date: row.date };
}
