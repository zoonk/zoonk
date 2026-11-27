import { type WritingSheet } from "../../../library/exams/written-grading";

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
  grading: readonly WritingSheet[] = [],
  increments: readonly number[] = [],
) {
  if (max === null || max >= SMALL_SCALE_MAX) {
    return max === null ? 0 : fractionPlaces(max);
  }

  const noticePlaces = grading.flatMap(({ combination, criteria, rounding }) =>
    [
      ...criteria.flatMap(({ awards, points }) => [
        points,
        ...(awards ?? []).flatMap((award) => [award.points, award.pointsHigh]),
      ]),
      rounding?.step,
      combination?.step,
    ].map((value) => fractionPlaces(value ?? 0)),
  );

  return Math.min(
    POINTS_PRECISION,
    Math.max(
      fractionPlaces(max),
      ...increments.map((value) => fractionPlaces(value)),
      ...noticePlaces,
    ),
  );
}
