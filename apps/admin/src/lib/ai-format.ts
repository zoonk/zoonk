const PRECISION = { detailed: 4, total: 2, whole: 0 } as const;
const LATENCY_DIGITS = 1;
const PERCENT = 100;

export function formatUsd(value: number, precision: keyof typeof PRECISION = "total"): string {
  const digits = PRECISION[precision];

  return value.toLocaleString("en", {
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
    style: "currency",
  });
}

export function formatLatency(seconds: number | null): string {
  return seconds === null ? "—" : `${seconds.toFixed(LATENCY_DIGITS)}s`;
}

export function formatTokens(tokens: number): string {
  return tokens.toLocaleString("en", { maximumFractionDigits: 1, notation: "compact" });
}

export function formatShare({ part, whole }: { part: number; whole: number }): string {
  return whole > 0 ? `${Math.round((part / whole) * PERCENT)}%` : "—";
}
