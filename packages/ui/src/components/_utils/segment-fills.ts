const PERCENT = 100;

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * How full each segment of a segmented bar is (0 to 1) when the whole bar is at `value` percent.
 * Segments are as wide as their `weights`, so filling them in order matches the percentage.
 */
export function getSegmentFills({
  value,
  weights,
}: {
  value: number;
  weights: readonly number[];
}): number[] {
  const sizes = weights.map((weight) => Math.max(0, weight));
  const total = sum(sizes);
  const reached = (Math.min(PERCENT, Math.max(0, value)) / PERCENT) * total;

  return sizes.map((size, index) => {
    const start = sum(sizes.slice(0, index));
    return size === 0 ? 0 : Math.min(1, Math.max(0, (reached - start) / size));
  });
}
