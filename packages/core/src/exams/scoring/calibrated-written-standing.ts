import { type WritingCalibration } from "../essays/_utils/writing-calibration";
import { isTextVerifiedWritingZero } from "../essays/_utils/writing-zero";
import { type WritingResult } from "../essays/writing-contract";
import { getWritingCalibration } from "../essays/writing-rubric-policy";
import { type WritingRange, writtenStanding } from "./written-points";

const PART_ERROR_RATE = 0.1;
const TAILS = 2;

type NumericGrade = Extract<WritingResult, { kind: "points" }>;

type PointGrade = Pick<NumericGrade, "kind" | "max" | "total"> & {
  zeroKind?: NumericGrade["zeroKind"] | null;
};

export type CalibratedWritingGrade = PointGrade & {
  calibration: Pick<WritingCalibration, "residuals" | "verdicts">;
};

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

  const calibration = getWritingCalibration({ basis, observed });
  const { kind, max, total, zeroKind } = grade;
  return calibration ? { calibration, kind, max, total, zeroKind } : null;
}

function margin(residuals: readonly number[], level: number): number | null {
  return residuals[Math.ceil((residuals.length + 1) * level) - 1] ?? null;
}

function isVerifiedZero({ total, zeroKind }: CalibratedWritingGrade) {
  return isTextVerifiedWritingZero(zeroKind) && total.low === 0 && total.high === 0;
}

function bound({
  grade,
  level,
  side,
}: {
  grade: CalibratedWritingGrade | null;
  level: number;
  side: "above" | "below";
}): number | null {
  if (!grade) {
    return null;
  }

  if (isVerifiedZero(grade)) {
    return 0;
  }

  const { residuals, verdicts } = grade.calibration;

  if (!verdicts[side]) {
    return null;
  }

  const ranked = margin(side === "above" ? residuals.over : residuals.under, level);

  if (ranked === null) {
    return null;
  }

  return side === "above"
    ? grade.total.low - ranked * grade.max
    : grade.total.high + ranked * grade.max;
}

function sumBounds(bounds: readonly (number | null)[]): number | null {
  return bounds.length === 0 || bounds.some((value) => value === null)
    ? null
    : bounds.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

type PartMinimum = Pick<Parameters<typeof writtenStanding>[0], "max" | "minimum">;

/**
 * Each side is called only when the calibration switches its verdict on and has a residual at the
 * part's rank; a part with one side missing is never reported as overlapping the minimum.
 */
export function calibratedWrittenStanding({
  grades,
  part,
}: {
  grades: readonly (CalibratedWritingGrade | null)[];
  part: PartMinimum;
}) {
  const level = 1 - PART_ERROR_RATE / (TAILS * grades.length);
  const low = sumBounds(grades.map((grade) => bound({ grade, level, side: "above" })));
  const high = sumBounds(grades.map((grade) => bound({ grade, level, side: "below" })));

  if (low === null && high === null) {
    return writtenStanding({ ...part, range: null });
  }

  const range: WritingRange = {
    high: high ?? Number.POSITIVE_INFINITY,
    low: low ?? Number.NEGATIVE_INFINITY,
  };

  const standing = writtenStanding({ ...part, range });
  return standing === "overlaps" && (low === null || high === null) ? "unmeasured" : standing;
}
