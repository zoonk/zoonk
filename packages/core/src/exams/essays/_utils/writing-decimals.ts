import { type z } from "zod";
import { type writtenGradingSchema } from "../../../library/exams/written-grading";
import { getWritingRounding } from "./writing-task-basis";

const SMALL_SCALE_MAX = 10;
const POINTS_PRECISION = 15;

function fractionPlaces(value: number) {
  const [coefficient = "", exponent = "0"] = Number(value.toPrecision(POINTS_PRECISION))
    .toString()
    .split("e");

  return Math.max(0, (coefficient.split(".")[1]?.length ?? 0) - Number(exponent));
}

export function getWritingDecimals(
  max: number | null,
  grading: readonly z.infer<typeof writtenGradingSchema>[] = [],
  increments: readonly number[] = [],
) {
  if (max === null || max >= SMALL_SCALE_MAX) {
    return max === null ? 0 : fractionPlaces(max);
  }

  const noticePlaces = grading.flatMap(({ criteria, rounding }) => {
    const rule = getWritingRounding(rounding);

    return [
      ...criteria.map(({ points }) => fractionPlaces(points ?? 0)),
      typeof rule === "object" ? (rule?.places ?? 0) : 0,
    ];
  });

  return Math.min(
    POINTS_PRECISION,
    Math.max(
      fractionPlaces(max),
      ...increments.map((value) => fractionPlaces(value)),
      ...noticePlaces,
    ),
  );
}
