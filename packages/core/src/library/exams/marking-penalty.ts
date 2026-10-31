const MAX_DENOMINATOR = 12;
const FRACTION_TOLERANCE = 0.005;

export function normalizePenalty(value: number): number {
  const nearest =
    Array.from({ length: MAX_DENOMINATOR }, (_, index) => {
      const denominator = index + 1;
      return Math.round(value * denominator) / denominator;
    }).toSorted((first, second) => Math.abs(first - value) - Math.abs(second - value))[0] ?? value;

  return Math.abs(nearest - value) <= FRACTION_TOLERANCE ? nearest : value;
}

export function getMarkingPenalty({
  points,
  wrongPoints,
}: {
  points: number;
  wrongPoints: number | null;
}): number | null {
  return wrongPoints === null || wrongPoints < 0 || wrongPoints > points
    ? null
    : normalizePenalty(wrongPoints / points);
}
