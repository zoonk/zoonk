/**
 * Largest remainder (ties to the earlier weight), so the counts add up to `total`; equal shares
 * when every weight is zero.
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

/**
 * Rows of exact amounts, each rounded so the rows add up to the rounded total a screen writes over
 * them: a total of "12 min" never sits over rows that add to 11.
 */
export function roundToTotal(parts: readonly number[]): number[] {
  const total = Math.round(parts.reduce((sum, part) => sum + part, 0));
  return parts.length > 0 ? apportion({ total, weights: parts }) : [];
}
