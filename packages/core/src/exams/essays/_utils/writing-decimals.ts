import { type WritingSheet } from "../../../library/exams/written-grading";
import { type WritingRange } from "../../scoring/written-points";

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

function visibleFractionPlaces(value: number) {
  const limit = Math.min(POINTS_PRECISION, fractionPlaces(value));

  for (let decimals = 1; decimals < limit; decimals += 1) {
    const scale = 10 ** decimals;
    const scaled = Number((value * scale).toPrecision(POINTS_PRECISION));

    if (Math.round(scaled) % scale !== 0) {
      return decimals;
    }
  }

  return limit;
}

export function getWritingRowDecimals({
  earned,
  max,
  range,
}: {
  earned: number;
  max: number;
  range?: WritingRange;
}) {
  return Math.max(
    getWritingDecimals(max),
    visibleFractionPlaces(range?.low ?? earned),
    visibleFractionPlaces(range?.high ?? earned),
  );
}
