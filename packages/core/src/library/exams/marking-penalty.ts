const REPEATING_DENOMINATORS = { ninths: 9, sixths: 6, thirds: 3, twelfths: 12 };
const TERMINATING_DENOMINATOR = 4;

const REPEATING_FRACTIONS = Object.values(REPEATING_DENOMINATORS).flatMap((denominator) =>
  Array.from({ length: denominator - 1 }, (_, index) => (index + 1) / denominator).filter(
    (fraction) => !Number.isInteger(fraction * TERMINATING_DENOMINATOR),
  ),
);

export function normalizePenalty(value: number): number {
  const digits = value.toString().split(".")[1];

  if (!digits || digits.length < 2) {
    return value;
  }

  const precision = 10 ** digits.length;
  const stated = Number(digits);

  const matches = [
    ...new Set(
      REPEATING_FRACTIONS.filter(
        (fraction) =>
          Math.round(fraction * precision) === stated ||
          Math.trunc(fraction * precision) === stated,
      ),
    ),
  ];

  const [fraction, ...others] = matches;

  return fraction !== undefined && others.length === 0
    ? Math.trunc(value) + Math.sign(value) * fraction
    : value;
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
