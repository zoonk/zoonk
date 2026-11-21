import { type WritingPrompt } from "@zoonk/core/exams/essays/writing-contract";

const PERCENT = 100;

type Minimum = NonNullable<WritingPrompt["partMinimum"]>["minimum"];

/** Where a minimum falls on a scale, as a share of it. */
export function getMinimumShare({
  max,
  minimum,
}: {
  max: number | null;
  minimum: Minimum;
}): number | null {
  if (minimum.unit === "percent") {
    return minimum.value / PERCENT;
  }

  return max ? minimum.value / max : null;
}

/** A minimum in points on its scale, so it's said and subtracted as points: 50% of 40 is 20. */
export function getMinimumPoints({
  max,
  minimum,
}: {
  max: number | null;
  minimum: Minimum;
}): number | null {
  if (minimum.unit === "points") {
    return minimum.value;
  }

  return max ? (minimum.value / PERCENT) * max : null;
}
