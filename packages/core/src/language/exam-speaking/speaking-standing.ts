import { type SpeakingCriterionView, type SpeakingEstimate } from "./speaking-contract";

/** Goethe's scales name no band for the level; its modules pass from 60% of their points. */
const PASS_SHARE = 0.6;

export function getLevelMark(criterion: { levelBand: number | null; maxBand: number }): number {
  return criterion.levelBand ?? criterion.maxBand * PASS_SHARE;
}

export function getLevelStanding({
  bandHigh,
  bandLow,
  levelMark,
}: {
  bandHigh: number;
  bandLow: number;
  levelMark: number;
}): "at" | "near" | "below" {
  if ((bandLow + bandHigh) / 2 >= levelMark) {
    return "at";
  }

  return bandHigh >= levelMark ? "near" : "below";
}

/** Goethe's letters by band: 0 is E, 4 is A. */
const LETTERS = ["E", "D", "C", "B", "A"];

export function getSpeakingEstimate({
  bandHigh,
  bandLow,
  criterion,
}: {
  bandHigh: number;
  bandLow: number;
  criterion: Pick<SpeakingCriterionView, "display" | "maxBand" | "points">;
}): SpeakingEstimate {
  if (criterion.display === "letter") {
    return {
      display: "letter",
      high: LETTERS[Math.round(bandHigh)] ?? "",
      low: LETTERS[Math.round(bandLow)] ?? "",
    };
  }

  const { points } = criterion;

  if (criterion.display === "points" && points) {
    const toPoints = (band: number) => points[Math.round(band)] ?? 0;

    return {
      display: "points",
      high: toPoints(bandHigh),
      low: toPoints(bandLow),
      max: points.at(-1) ?? 0,
    };
  }

  return { display: "band", high: bandHigh, low: bandLow, max: criterion.maxBand };
}
