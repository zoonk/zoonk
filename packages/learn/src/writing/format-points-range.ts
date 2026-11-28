import { roundOutward } from "./round-outward";

const DEDUCTION_DECIMALS = 1;
const FIXED_AMOUNT_DECIMALS = 2;
const MINUS = "−";

type FormatNumber = (
  value: number,
  options: { maximumFractionDigits: number; minimumFractionDigits?: number },
) => string;

function fixedDecimals(decimals: number) {
  return { maximumFractionDigits: decimals, minimumFractionDigits: decimals };
}

/**
 * A fixed amount, such as a maximum or a minimum, as it is: "22", "9.5", "1.25". It never pads to a
 * mark's decimals, so a criterion reads "14.7 of 22", never "14.7 of 22.0".
 */
export function formatFixedPoints(value: number, number: FormatNumber): string {
  return number(value, { maximumFractionDigits: FIXED_AMOUNT_DECIMALS });
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
  number: FormatNumber;
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
