import { type NumericEntry } from "@zoonk/ai/tasks/v2/items/schemas";
import { countDecimalPlaces, isRoundedAnswer } from "@zoonk/utils/rounded-answer";
import { withinTolerance } from "../../activities/templates/_utils/pattern-checks";
import { isClose } from "../../activities/templates/_utils/template-helpers";

type Tolerance = { kind: "absolute" | "relative"; value: number };

export const ANY_NUMBER: NumericEntry = { kind: "number", places: null };

/** A decimal the SAT's grid takes for a fraction: at least three places (.667 or .666, not .67). */
const MIN_FRACTION_DECIMALS = 3;

function matchesFraction({ expected, value }: { expected: number; value: number }): boolean {
  const places = countDecimalPlaces(value);

  return (
    isClose(value, expected) ||
    (places >= MIN_FRACTION_DECIMALS && Math.abs(value - expected) < 10 ** -places)
  );
}

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
      return (
        withinTolerance({ expected, tolerance, value }) || isRoundedAnswer({ expected, value })
      );
    default:
      throw new Error("Unknown numeric entry.");
  }
}

export function fitsEntry({ entry, value }: { entry: NumericEntry; value: number }): boolean {
  return entry.kind !== "integer" || isClose(value, Math.round(value));
}
