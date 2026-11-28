type Range = { high: number; low: number };

/** 0.3 × 10 is 3.0000000000000004 in floating point, which must still round to 3. */
const FLOAT_SLACK = 1e-9;

/**
 * A headline range rounded outward to `decimals`, its low end down and its high end up, so it never
 * claims more than its parts. One grade isn't a range: it stays as it is, for the number format to
 * round as it rounds the parts beside it, so 48.01 reads "48", never "48–49". Zero stays zero,
 * never "−0".
 */
export function roundOutward({ high, low }: Range, decimals: number): Range {
  if (Math.abs(high - low) < FLOAT_SLACK) {
    return { high, low };
  }

  const step = 10 ** decimals;

  return {
    high: Math.ceil(high * step - FLOAT_SLACK) / step || 0,
    low: Math.floor(low * step + FLOAT_SLACK) / step || 0,
  };
}
