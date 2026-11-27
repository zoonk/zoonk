import { type RowCalibration, getWritingMargin } from "../essays/_utils/writing-calibration";
import { isTextVerifiedWritingZero } from "../essays/_utils/writing-zero";
import { type WritingResult } from "../essays/writing-contract";
import { getWritingCalibration } from "../essays/writing-rubric-policy";
import { type WritingRange, sumRanges, writtenStanding } from "./written-points";

type NumericGrade = Extract<WritingResult, { kind: "points" }>;

type PointGrade = Pick<NumericGrade, "kind" | "max" | "total"> & {
  zeroKind?: NumericGrade["zeroKind"] | null;
};

export type CalibratedWritingGrade = PointGrade & { calibration: readonly RowCalibration[] };

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

function widestMargin(calibration: readonly RowCalibration[], side: "over" | "under") {
  const margins = calibration.map(({ residuals }) => getWritingMargin(residuals[side]));

  return margins.length > 0 && margins.every((margin) => margin !== null)
    ? Math.max(...margins)
    : null;
}

function answerBounds(grade: CalibratedWritingGrade | null): WritingRange | null {
  if (!grade) {
    return null;
  }

  const { calibration, max, total, zeroKind } = grade;

  if (isTextVerifiedWritingZero(zeroKind) && total.low === 0 && total.high === 0) {
    return total;
  }

  const over = widestMargin(calibration, "over");
  const under = widestMargin(calibration, "under");

  return over === null || under === null
    ? null
    : { high: total.high + under * max, low: total.low - over * max };
}

type PartMinimum = Pick<Parameters<typeof writtenStanding>[0], "max" | "minimum">;

export function calibratedWrittenStanding({
  grades,
  part,
}: {
  grades: readonly (CalibratedWritingGrade | null)[];
  part: PartMinimum;
}) {
  return writtenStanding({ ...part, range: sumRanges(grades.map((grade) => answerBounds(grade))) });
}
