import {
  type RowCalibration,
  WRITING_PART_ERROR_RATE,
  rankWritingResiduals,
} from "../essays/_utils/writing-calibration";
import { isTextVerifiedWritingZero } from "../essays/_utils/writing-zero";
import { type WritingResult } from "../essays/writing-contract";
import { getWritingCalibration } from "../essays/writing-rubric-policy";
import { type WritingRange, writtenStanding } from "./written-points";

const TAILS = 2;

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

function isVerifiedZero({ total, zeroKind }: CalibratedWritingGrade) {
  return isTextVerifiedWritingZero(zeroKind) && total.low === 0 && total.high === 0;
}

function bound({
  grade,
  tailErrorRate,
  side,
}: {
  grade: CalibratedWritingGrade | null;
  tailErrorRate: number;
  side: "above" | "below";
}): number | null {
  if (!grade) {
    return null;
  }

  if (isVerifiedZero(grade)) {
    return 0;
  }

  const ranks = grade.calibration.map(({ residuals, verdicts }) =>
    verdicts[side]
      ? rankWritingResiduals(
          side === "above" ? residuals.over : residuals.under,
          1 - tailErrorRate / grade.calibration.length,
        )
      : null,
  );

  const ranked = sumBounds(ranks);

  if (ranked === null) {
    return null;
  }

  const margin = Math.min(1, ranked) * grade.max;
  return side === "above" ? grade.total.low - margin : grade.total.high + margin;
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
  const tailErrorRate = WRITING_PART_ERROR_RATE / (TAILS * grades.length);
  const low = sumBounds(grades.map((grade) => bound({ grade, side: "above", tailErrorRate })));
  const high = sumBounds(grades.map((grade) => bound({ grade, side: "below", tailErrorRate })));

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
