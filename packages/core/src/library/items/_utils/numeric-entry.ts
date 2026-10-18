import { type NumericEntry } from "@zoonk/ai/tasks/v2/items/schemas";
import { withinTolerance } from "../../activities/templates/_utils/pattern-checks";
import { isClose } from "../../activities/templates/_utils/template-helpers";

type Tolerance = { kind: "absolute" | "relative"; value: number };

/** Any number, graded by the item's tolerance: how every numeric item read before entry rules. */
export const ANY_NUMBER: NumericEntry = { kind: "number", places: null };

/** A decimal the SAT's grid takes for a fraction: at least three places (.667 or .666, not .67). */
const MIN_FRACTION_DECIMALS = 3;

/** Decimal places a number has as typed: 0.667 has 3, 2 has none, 1e-7 has 7. */
function countDecimalPlaces(value: number): number {
  const [digits = "", exponent] = String(Math.abs(value)).split("e-");
  const places = digits.split(".")[1]?.length ?? 0;
  return exponent ? places + Number(exponent) : places;
}

/** A fraction's exact value, or a decimal that fills the grid, rounded or cut short. */
function matchesFraction({ expected, value }: { expected: number; value: number }): boolean {
  const places = countDecimalPlaces(value);

  return (
    isClose(value, expected) ||
    (places >= MIN_FRACTION_DECIMALS && Math.abs(value - expected) < 10 ** -places)
  );
}

/**
 * Whether a typed number is the expected answer, the way the item's answer box takes it: within
 * the tolerance for any number, the exact whole number for an integer answer, rounded or cut to
 * the decimal places asked, or a fraction's value (2/3, or .667 and .666 the way the SAT's grid
 * takes it, never .67).
 */
export function matchesEntry({
  entry,
  expected,
  tolerance,
  value,
}: {
  entry: NumericEntry;
  expected: number;
  tolerance: Tolerance;
  value: number;
}): boolean {
  switch (entry.kind) {
    case "integer":
      return Number.isInteger(value) && isClose(value, expected);
    case "decimals":
      return Math.abs(value - expected) <= 10 ** -(entry.places ?? 0) + Number.EPSILON;
    case "fraction":
      return matchesFraction({ expected, value });
    case "number":
      return withinTolerance({ expected, tolerance, value });
    default:
      throw new Error("Unknown numeric entry.");
  }
}

/** Whether an answer is one the answer box can take: a whole number for an integer answer. */
export function fitsEntry({ entry, value }: { entry: NumericEntry; value: number }): boolean {
  return entry.kind !== "integer" || isClose(value, Math.round(value));
}
