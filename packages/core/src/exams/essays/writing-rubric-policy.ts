import { type WrittenTask, addWritingPoints } from "../scoring/written-points";
import { ENEM_WRITING_MAX, hasEnemCompetences } from "./_utils/enem-writing";
import { writingCalibration } from "./_utils/writing-calibration";
import { getWritingRounding } from "./_utils/writing-task-basis";

export type WritingArithmetic = { rounding: { mode: "nearest" | "down"; places: number } | null };

type Basis = Pick<WrittenTask, "grading" | "points">;
export type WritingGrader = { model: string; promptVersion: string };

export function supportsWritingArithmetic({ language }: Basis["grading"]) {
  return !language || (language.method !== "other" && language.factor !== null && language.formula);
}

export function getWritingCalibration({
  basis,
  observed,
}: {
  basis: Basis;
  observed?: WritingGrader;
}) {
  const { grading, points } = basis;
  const { criteria, kind } = grading;

  if (
    points === null ||
    kind === "levels" ||
    !supportsWritingArithmetic(grading) ||
    getWritingRounding(grading.rounding) === "unknown" ||
    (kind === "enem"
      ? points !== ENEM_WRITING_MAX || !hasEnemCompetences(criteria)
      : criteria.length === 0 ||
        criteria.some((criterion) => criterion.points === null) ||
        criteria.reduce((total, criterion) => addWritingPoints(total, criterion.points ?? 0), 0) !==
          points)
  ) {
    return null;
  }

  const entry = kind === "enem" ? writingCalibration.enem : writingCalibration.keyed;

  const revision =
    kind === "enem"
      ? writingCalibration.enem?.grader.promptRevision.enem
      : writingCalibration.keyed?.grader.promptRevision[kind];

  return entry?.points &&
    (!observed || (observed.model === entry.grader.model && observed.promptVersion === revision))
    ? entry
    : null;
}

export function getWritingArithmetic(
  basis: Basis,
  observed?: WritingGrader,
): WritingArithmetic | null {
  if (!getWritingCalibration({ basis, observed })) {
    return null;
  }

  const rule = getWritingRounding(basis.grading.rounding);
  return { rounding: rule && rule !== "unknown" && rule.mode !== "none" ? rule : null };
}

export function isNumericWritingRubric(basis: Basis): boolean {
  return getWritingCalibration({ basis }) !== null;
}
