const REPEATING_DENOMINATORS = { ninths: 9, sixths: 6, thirds: 3, twelfths: 12 };
const TERMINATING_DENOMINATOR = 4;

const REPEATING_FRACTIONS = Object.values(REPEATING_DENOMINATORS).flatMap((denominator) =>
  Array.from({ length: denominator - 1 }, (_, index) => (index + 1) / denominator).filter(
    (fraction) => !Number.isInteger(fraction * TERMINATING_DENOMINATOR),
  ),
);

const FRACTION_TOLERANCE = 0.01;

export function normalizePenalty(value: number): number {
  const nearest =
    REPEATING_FRACTIONS.toSorted(
      (first, second) => Math.abs(first - value) - Math.abs(second - value),
    )[0] ?? value;

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
    : normalizePenalty(wrongPoints) / points;
}
