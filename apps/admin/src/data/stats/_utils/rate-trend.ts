export type RateTrendRow = { date: Date; denominator: bigint; numerator: bigint };

/** The rate is computed after aggregation, so large and small days weigh correctly. */
export function toRateTrendPoint(row: RateTrendRow) {
  const denominator = Number(row.denominator);
  const numerator = Number(row.numerator);

  return { count: denominator === 0 ? 0 : (numerator / denominator) * 100, date: row.date };
}
