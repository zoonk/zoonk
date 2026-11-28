import { type WrittenTask } from "../scoring/written-points";
import {
  type RowCalibration,
  type WritingGrader,
  writingCalibration,
} from "./_utils/writing-calibration";
import { type SheetBasis, getScoringRowKinds, isComputableSheet } from "./_utils/writing-sheet";
import { type WritingRowKind } from "./writing-contract";

type TaskBasis = Pick<WrittenTask, "grading" | "points">;
type Basis = TaskBasis & { aspects?: SheetBasis["aspects"]; rowKinds?: WritingRowKind[] };
export type { WritingGrader } from "./_utils/writing-calibration";

export function getWritingCalibration({
  basis,
  observed,
}: {
  basis: Basis;
  observed?: WritingGrader;
}): RowCalibration[] | null {
  const calibration = writingCalibration;

  if (
    !calibration ||
    !isComputableSheet(basis) ||
    (observed &&
      (observed.model !== calibration.grader.model ||
        observed.promptVersion !== calibration.grader.promptVersion))
  ) {
    return null;
  }

  const kinds = basis.rowKinds ?? getScoringRowKinds(basis);

  const rows = kinds.flatMap((kind) => calibration.rows[kind] ?? []);

  return rows.length > 0 && rows.length === kinds.length ? rows : null;
}

export function canCalibrateWritingTask(basis: TaskBasis): boolean {
  const rows = writingCalibration?.rows;

  return Boolean(
    rows &&
    isComputableSheet(basis) &&
    basis.grading.criteria.every(({ awards }) =>
      awards ? rows.boardScale : rows.definitePoint || rows.judgedScale,
    ),
  );
}

export function isNumericWritingRubric(basis: Basis, observed?: WritingGrader): boolean {
  return getWritingCalibration({ basis, observed }) !== null;
}
