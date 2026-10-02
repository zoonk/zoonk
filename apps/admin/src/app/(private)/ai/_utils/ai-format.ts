/** Per-call costs are fractions of a cent, so small amounts keep more digits than totals. */
const SMALL_AMOUNT_DIGITS = 4;
const AMOUNT_DIGITS = 2;
const LATENCY_DIGITS = 1;

export function formatUsd(value: number): string {
  const digits = Math.abs(value) < 1 ? SMALL_AMOUNT_DIGITS : AMOUNT_DIGITS;

  return value.toLocaleString("en", {
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: AMOUNT_DIGITS,
    style: "currency",
  });
}

export function formatLatency(seconds: number | null): string {
  return seconds === null ? "—" : `${seconds.toFixed(LATENCY_DIGITS)}s`;
}
