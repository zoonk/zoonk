import { roundOutward } from "./round-outward";

const DEDUCTION_DECIMALS = 1;
const MINUS = "−";

export function fixedDecimals(decimals: number) {
  return { maximumFractionDigits: decimals, minimumFractionDigits: decimals };
}

export function formatPointsRange({
  decimals = 0,
  joinDeduction,
  kind = "detail",
  number,
  range,
}: {
  decimals?: number;
  joinDeduction: (low: string, high: string) => string;
  kind?: "deduction" | "detail" | "estimate";
  number: (value: number, options: ReturnType<typeof fixedDecimals>) => string;
  range: { high: number; low: number };
}): string {
  const options = fixedDecimals(kind === "deduction" ? DEDUCTION_DECIMALS : decimals);

  const { high, low } = kind === "estimate" ? roundOutward(range, decimals) : range;

  const from = number(low || 0, options);
  const to = number(high || 0, options);

  if (kind === "deduction") {
    const zero = number(0, options);
    const signed = (end: string) => (end === zero ? end : `${MINUS}${end}`);

    if (to === zero) {
      return number(0, fixedDecimals(0));
    }

    return from === to ? signed(from) : joinDeduction(signed(from), signed(to));
  }

  return from === to ? from : `${from}–${to}`;
}
