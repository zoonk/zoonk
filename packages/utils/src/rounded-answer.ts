const MIN_SIGNIFICANT_DIGITS = 2;

const HALF_A_PLACE = 0.5;

const FLOAT_SLACK = 1e-9;

export function countDecimalPlaces(value: number): number {
  const [digits = "", exponent] = String(Math.abs(value)).split("e-");
  const places = digits.split(".")[1]?.length ?? 0;
  return exponent ? places + Number(exponent) : places;
}

function countWrittenDecimalPlaces(value: string): number {
  const [digits = "", exponent = "0"] = value.toLowerCase().split("e");
  const places = digits.split(".")[1]?.length ?? 0;
  return places - Number(exponent);
}

function countSignificantDigits(value: number | string): number {
  const [mantissa = ""] = String(value).trim().replace(/^[+-]/u, "").toLowerCase().split("e");
  const digits = mantissa.replace(".", "").replace(/^0+/u, "");
  const significant = mantissa.includes(".") ? digits : digits.replace(/0+$/u, "");
  return significant.length;
}

/**
 * A number rounded too far to show the value ("0" for 0.4, "10" for 11.88) isn't right. Pass the
 * written decimal when available, so trailing zeroes keep their precision.
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
