import { type WritingResiduals } from "../essays/_utils/writing-calibration";
import { isTextVerifiedWritingZero } from "../essays/_utils/writing-zero";
import { type WritingResult } from "../essays/writing-contract";
import { getWritingCalibration } from "../essays/writing-rubric-policy";
import { sumRanges, writtenStanding } from "./written-points";

const PART_ERROR_RATE = 0.1;

type NumericGrade = Extract<WritingResult, { kind: "points" }>;

type PointGrade = Pick<NumericGrade, "kind" | "max" | "total"> & {
  zeroKind?: NumericGrade["zeroKind"] | null;
};

export type CalibratedWritingGrade = PointGrade & { residuals: WritingResiduals };

export function getCalibratedWritingGrade({
  basis,
  grade,
  observed,
}: Parameters<typeof getWritingCalibration>[0] & {
  grade: PointGrade | { kind: "levels" };
}): CalibratedWritingGrade | null {
  if (grade.kind !== "points" || (!observed && !isTextVerifiedWritingZero(grade.zeroKind))) {
    return null;
  }

  const residuals = getWritingCalibration({ basis, observed });
  const { kind, max, total, zeroKind } = grade;
  return residuals ? { kind, max, residuals, total, zeroKind } : null;
}

function margin(residuals: readonly number[], floor: number, level: number): number | null {
  const ranked = residuals[Math.ceil((residuals.length + 1) * level) - 1];
  return ranked === undefined ? null : Math.max(ranked, floor);
}

function widen({ grade, level }: { grade: CalibratedWritingGrade | null; level: number }) {
  if (!grade) {
    return null;
  }

  if (
    isTextVerifiedWritingZero(grade.zeroKind) &&
    grade.total.low === 0 &&
    grade.total.high === 0
  ) {
    return grade.total;
  }

  const { over, overFloor, under, underFloor } = grade.residuals;
  const lower = margin(over, overFloor, level);
  const upper = margin(under, underFloor, level);

  return lower === null || upper === null
    ? null
    : { high: grade.total.high + upper * grade.max, low: grade.total.low - lower * grade.max };
}

type PartMinimum = Pick<Parameters<typeof writtenStanding>[0], "max" | "minimum">;

export function calibratedWrittenStanding({
  grades,
  part,
}: {
  grades: readonly (CalibratedWritingGrade | null)[];
  part: PartMinimum;
}) {
  const level = 1 - PART_ERROR_RATE / grades.length;
  const range = sumRanges(grades.map((grade) => widen({ grade, level })));
  return writtenStanding({ ...part, range });
}
