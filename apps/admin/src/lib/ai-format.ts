/** Per-call costs are fractions of a cent, so small amounts keep more digits than totals. */
const SMALL_AMOUNT_DIGITS = 4;
const AMOUNT_DIGITS = 2;
const LATENCY_DIGITS = 1;
const PERCENT = 100;

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

/** Token counts in the millions read better compact ("12.4M"). */
export function formatTokens(tokens: number): string {
  return tokens.toLocaleString("en", { maximumFractionDigits: 1, notation: "compact" });
}

/** A part of a whole as a percentage, or a dash when there's nothing to divide by. */
export function formatShare({ part, whole }: { part: number; whole: number }): string {
  return whole > 0 ? `${Math.round((part / whole) * PERCENT)}%` : "—";
}
