/**
 * Shares `total` whole units among `weights` in proportion, by the largest remainder (ties to the
 * earlier one), so the counts always add up to `total`. Equal shares when every weight is zero.
 */
export function apportion({
  total,
  weights,
}: {
  total: number;
  weights: readonly number[];
}): number[] {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);

  const exact = weights.map((weight) =>
    sum > 0 ? (total * weight) / sum : total / weights.length,
  );

  const whole = exact.map((share) => Math.floor(share));
  const left = total - whole.reduce((acc, count) => acc + count, 0);

  const extra = new Set(
    exact
      .map((share, index) => ({ index, remainder: share - (whole[index] ?? 0) }))
      .toSorted((a, b) => b.remainder - a.remainder || a.index - b.index)
      .slice(0, left)
      .map((entry) => entry.index),
  );

  return whole.map((count, index) => count + (extra.has(index) ? 1 : 0));
}
