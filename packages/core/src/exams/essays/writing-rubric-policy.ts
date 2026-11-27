import { type WrittenTask } from "../scoring/written-points";
import { type WritingCalibration, writingCalibration } from "./_utils/writing-calibration";
import { isComputableSheet } from "./_utils/writing-sheet";

type Basis = Pick<WrittenTask, "grading" | "points">;
export type WritingGrader = WritingCalibration["grader"];

export function getWritingCalibration({
  basis,
  observed,
}: {
  basis: Basis;
  observed?: WritingGrader;
}): WritingCalibration | null {
  const calibration = writingCalibration;

  if (!calibration?.points || !isComputableSheet(basis)) {
    return null;
  }

  return !observed ||
    (observed.model === calibration.grader.model &&
      observed.promptVersion === calibration.grader.promptVersion)
    ? calibration
    : null;
}

/** Feeds the API's `rubric` fields until its clients read the sheet itself. */
export function getWritingRubric(basis: Basis): "points" | "levels" {
  return isComputableSheet(basis) ? "points" : "levels";
}

export function isNumericWritingRubric(basis: Basis, observed?: WritingGrader): boolean {
  return getWritingCalibration({ basis, observed }) !== null;
}
