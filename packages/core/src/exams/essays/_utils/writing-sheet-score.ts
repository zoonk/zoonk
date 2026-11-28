import { type WritingEvidence } from "@zoonk/ai/tasks/grading/grade-essay";
import { type WritingSheet } from "../../../library/exams/written-grading";
import { type WritingRange, addWritingPoints } from "../../scoring/written-points";
import { type RowMark } from "./writing-marks";
import { createWritingQuoteLookup } from "./writing-quotes";
import { type SheetBasis, isKeyedCriterion, topAwardPoints } from "./writing-sheet";

type Criterion = WritingSheet["criteria"][number];
type Rounding = NonNullable<WritingSheet["rounding"]>;
type CriterionScore = { id: string; max: number; range: WritingRange };

const SNAP = { down: Math.floor, nearest: Math.round, up: Math.ceil } as const;

function snapToStep({
  mode = "nearest",
  step,
  value,
}: {
  mode?: keyof typeof SNAP;
  step: number;
  value: number;
}): number {
  return addWritingPoints(SNAP[mode](addWritingPoints(value / step, 0)) * step, 0);
}

export function roundWritingRange({
  range,
  rounding,
  stage,
}: {
  range: WritingRange;
  rounding: WritingSheet["rounding"];
  stage: NonNullable<Rounding["stage"]>;
}): WritingRange {
  if (!rounding?.step || !rounding.mode || rounding.stage !== stage) {
    return range;
  }

  const { mode, step } = rounding;

  return {
    high: snapToStep({ mode, step, value: range.high }),
    low: snapToStep({ mode, step, value: range.low }),
  };
}

function addRanges(ranges: readonly WritingRange[]): WritingRange {
  return ranges.reduce<WritingRange>(
    (sum, range) => ({
      high: addWritingPoints(sum.high, range.high),
      low: addWritingPoints(sum.low, range.low),
    }),
    { high: 0, low: 0 },
  );
}

function awardRange({ row, verified }: RowMark): WritingRange | null {
  const award = verified === null ? undefined : row.awards[verified];

  return award && award.points !== null
    ? { high: award.pointsHigh ?? award.points, low: award.points }
    : null;
}

function scaleRange(criterion: Criterion, marks: readonly RowMark[]): WritingRange | null {
  const mark = marks.find(({ row }) => row.kind === "scale" && row.criterionId === criterion.id);
  return mark ? awardRange(mark) : null;
}

function keyedRange({
  basis,
  criterion,
  marks,
}: {
  basis: SheetBasis;
  criterion: Criterion;
  marks: readonly RowMark[];
}): WritingRange | null {
  const own = marks.filter(({ row }) => row.kind === "aspect" && row.criterionId === criterion.id);
  const ranges = own.flatMap((mark) => awardRange(mark) ?? []);

  const full = own.reduce(
    (sum, { row }) => addWritingPoints(sum, topAwardPoints(row.awards) ?? 0),
    0,
  );

  return isKeyedCriterion(basis, criterion.id) &&
    ranges.length === own.length &&
    full === criterion.points
    ? addRanges(ranges)
    : null;
}

export function verifiedLimits({
  eligible,
  evidence,
  sheet,
}: {
  eligible: string;
  evidence: Pick<WritingEvidence, "limits">;
  sheet: WritingSheet;
}) {
  const lookup = createWritingQuoteLookup(eligible);

  return evidence.limits.flatMap(({ limit, quote }) => {
    const rule = sheet.limits?.[limit];
    return rule && lookup.locate(quote) ? [rule] : [];
  });
}

/** The points each verified limit on a criterion leaves it, beside its own maximum. */
export function criterionCeilings({
  id,
  limits,
  max,
}: {
  id: string;
  limits: readonly { criteria: readonly string[]; max: number }[];
  max: number;
}): number[] {
  return [max, ...limits.filter(({ criteria }) => criteria.includes(id)).map((limit) => limit.max)];
}

function capRange(range: WritingRange, caps: readonly number[]): WritingRange {
  const cap = Math.min(...caps);
  return { high: Math.min(range.high, cap), low: Math.min(range.low, cap) };
}

function combine(sheet: WritingSheet, scores: readonly CriterionScore[]): WritingRange {
  const { combination, criteria } = sheet;

  const mean = (side: "high" | "low") => {
    const weights = criteria.map(({ weight }) => weight ?? 1);

    const total = scores.reduce(
      (sum, score, index) => sum + score.range[side] * (weights[index] ?? 1),
      0,
    );

    return addWritingPoints(total / weights.reduce((sum, weight) => sum + weight, 0), 0);
  };

  const combined =
    combination?.method === "mean"
      ? { high: mean("high"), low: mean("low") }
      : addRanges(scores.map(({ range }) => range));

  const step = combination?.step;

  return step
    ? {
        high: snapToStep({ step, value: combined.high }),
        low: snapToStep({ step, value: combined.low }),
      }
    : combined;
}

/**
 * The answer's mark before the language deduction, or null when a row's award could not be turned
 * into the board's points.
 */
export function scoreWritingSheet({
  basis,
  eligible,
  evidence,
  marks,
  zero,
}: {
  basis: SheetBasis;
  eligible: string;
  evidence: Pick<WritingEvidence, "limits">;
  marks: readonly RowMark[];
  zero: boolean;
}): { content: WritingRange; scores: CriterionScore[] } | null {
  const sheet = basis.grading;
  const limits = verifiedLimits({ eligible, evidence, sheet });

  const scores = sheet.criteria.flatMap((criterion): CriterionScore[] => {
    const max = criterion.points ?? topAwardPoints(criterion.awards ?? []);

    const earned = criterion.awards
      ? scaleRange(criterion, marks)
      : keyedRange({ basis, criterion, marks });

    if (max === null || (!zero && !earned)) {
      return [];
    }

    const ceilings = criterionCeilings({ id: criterion.id, limits, max });

    const rounded = roundWritingRange({
      range: capRange(zero || !earned ? { high: 0, low: 0 } : earned, ceilings),
      rounding: sheet.rounding,
      stage: "criterion",
    });

    // Rounding up can pass a ceiling that isn't on the rounding step.
    return [{ id: criterion.id, max, range: capRange(rounded, ceilings) }];
  });

  return scores.length === sheet.criteria.length
    ? { content: zero ? { high: 0, low: 0 } : combine(sheet, scores), scores }
    : null;
}
