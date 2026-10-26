/** Fewest significant digits a rounded answer keeps: "12" for 11.88 shows the value, "0" for 0.4 doesn't. */
const MIN_SIGNIFICANT_DIGITS = 2;

/** A number rounds to the typed one within half its last place: 11.85 to 11.95 read as 11.9. */
const HALF_A_PLACE = 0.5;

/** Rounding a computed answer can land a hair outside half a place. */
const FLOAT_SLACK = 1e-9;

/** Decimal places a number has as typed: 0.667 has 3, 2 has none, 1e-7 has 7. */
export function countDecimalPlaces(value: number): number {
  const [digits = "", exponent] = String(Math.abs(value)).split("e-");
  const places = digits.split(".")[1]?.length ?? 0;
  return exponent ? places + Number(exponent) : places;
}

/** Decimal places as written: 0.40 and 4.0e-1 both have 2. */
function countWrittenDecimalPlaces(value: string): number {
  const [digits = "", exponent = "0"] = value.toLowerCase().split("e");
  const places = digits.split(".")[1]?.length ?? 0;
  return places - Number(exponent);
}

/** Significant digits as typed: 12 and 0.38 have 2, 0.4 and 10 have 1, 0 has none. */
function countSignificantDigits(value: number | string): number {
  const [mantissa = ""] = String(value).trim().replace(/^[+-]/u, "").toLowerCase().split("e");
  const digits = mantissa.replace(".", "").replace(/^0+/u, "");
  const significant = mantissa.includes(".") ? digits : digits.replace(/0+$/u, "");
  return significant.length;
}

/**
 * Whether a typed number is the expected answer rounded to the places the learner typed, for a
 * question that asks no precision: "12" or "11.9" for 11.88. It keeps two significant digits at
 * least, so a number rounded too far to show the value ("0" for 0.4, "10" for 11.88) isn't right.
 * Pass the written decimal when available, so trailing zeroes keep their precision.
 */
export function isRoundedAnswer({
  expected,
  value,
}: {
  expected: number;
  value: number | string;
}): boolean {
  if (countSignificantDigits(value) < MIN_SIGNIFICANT_DIGITS) {
    return false;
  }

  const places =
    typeof value === "string" ? countWrittenDecimalPlaces(value) : countDecimalPlaces(value);

  const halfPlace = HALF_A_PLACE * 10 ** -places;
  return Math.abs(Number(value) - expected) <= halfPlace * (1 + FLOAT_SLACK);
}
