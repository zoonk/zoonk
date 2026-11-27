import { type WritingRow } from "@zoonk/ai/tasks/grading/grade-essay";
import { type z } from "zod";
import { type WritingSheet } from "../../../library/exams/written-grading";
import { addWritingPoints } from "../../scoring/written-points";
import { type writtenItemSchema } from "../writing-contract";

type Item = z.infer<typeof writtenItemSchema>;
type Criterion = WritingSheet["criteria"][number];
type Award = WritingRow["awards"][number];

export type SheetBasis = Pick<Item, "aspects" | "criteria" | "grading">;

/** `scale` rows are the board's own; `levels` rows stand in where it states none; `aspect` rows are a key's. */
export type SheetRow = WritingRow & { aspect?: number; kind: "aspect" | "levels" | "scale" };

const LEVEL_AWARDS: readonly Award[] = [
  { points: null, text: "The answer has nothing of what this criterion asks." },
  { points: null, text: "Part of it is there, with clear gaps." },
  { points: null, text: "Nearly all of it is there, with one small part missing or wrong." },
  { points: null, text: "The answer does everything this criterion asks." },
];

export function topAwardPoints(awards: readonly Award[]): number | null {
  const top = awards.at(-1);
  return top ? (top.pointsHigh ?? top.points) : null;
}

function isRisingScale(awards: readonly Award[]): boolean {
  return awards.every(({ points, pointsHigh }, index) => {
    const below = awards[index - 1];
    const floor = below ? (below.pointsHigh ?? below.points ?? 0) : 0;
    return points !== null && points >= floor && (pointsHigh ?? points) >= points;
  });
}

function criterionMaximum({ awards, points }: Criterion): number | null {
  if (!awards) {
    return points;
  }

  const top = topAwardPoints(awards);
  return isRisingScale(awards) && (points === null || points === top) ? top : null;
}

function combinedMaximum({ combination, criteria }: WritingSheet): number | null {
  const maxima = criteria.map((criterion) => criterionMaximum(criterion));

  if (maxima.length === 0 || maxima.some((max) => max === null)) {
    return null;
  }

  if (combination?.method !== "mean") {
    return maxima.reduce<number>((sum, max) => addWritingPoints(sum, max ?? 0), 0);
  }

  const weights = criteria.map(({ weight }) => weight ?? 1);
  const weight = weights.reduce((sum, value) => sum + value, 0);

  return addWritingPoints(
    maxima.reduce<number>((sum, max, index) => sum + (max ?? 0) * (weights[index] ?? 1), 0) /
      weight,
    0,
  );
}

function supportsWritingDeduction({ language }: Pick<WritingSheet, "language">): boolean {
  return (
    !language ||
    (language.method !== "other" && language.factor !== null && Boolean(language.formula))
  );
}

function readsRounding({ rounding }: Pick<WritingSheet, "rounding">): boolean {
  return !rounding || Boolean(rounding.mode && rounding.stage && rounding.step);
}

export function isComputableSheet({
  grading,
  points,
}: {
  grading: WritingSheet;
  points: number | null;
}): boolean {
  const ids = new Set(grading.criteria.map(({ id }) => id));

  return (
    points !== null &&
    !grading.totalSuppressed &&
    ids.size === grading.criteria.length &&
    supportsWritingDeduction(grading) &&
    readsRounding(grading) &&
    (grading.limits ?? []).every(({ criteria }) => criteria.every((id) => ids.has(id))) &&
    combinedMaximum(grading) === points
  );
}

function aspectAwards({ awards, points }: Item["aspects"][number]): readonly Award[] {
  return (
    awards ?? [
      { points: points === null ? null : 0, text: "The answer does not make this point." },
      { points, text: "The answer makes this point." },
    ]
  );
}

/** A criterion is keyed when the board states no scale for it and every aspect under it has points. */
export function isKeyedCriterion({ aspects, grading }: SheetBasis, id: string): boolean {
  const own = aspects.filter(({ criterionId }) => criterionId === id);
  const scaled = grading.criteria.some((criterion) => criterion.id === id && criterion.awards);
  return !scaled && own.length > 0 && own.every(({ points }) => points !== null);
}

export function listWritingRows(basis: SheetBasis): SheetRow[] {
  const sheet = new Map(basis.grading.criteria.map((criterion) => [criterion.id, criterion]));

  const criteria = basis.criteria.flatMap(({ id, name }): SheetRow[] => {
    const criterion = sheet.get(id);

    if (criterion?.awards) {
      return [
        {
          awards: criterion.awards.map(({ citation: _citation, ...award }) => award),
          criterionId: id,
          kind: "scale",
          ...(criterion.parts && {
            parts: criterion.parts.map(({ id: part, text }) => ({ id: part, text })),
          }),
          text: criterion.text,
        },
      ];
    }

    return isKeyedCriterion(basis, id)
      ? []
      : [{ awards: LEVEL_AWARDS, criterionId: id, kind: "levels", text: criterion?.text ?? name }];
  });

  const aspects = basis.aspects.map((aspect, index): SheetRow => ({
    aspect: index,
    awards: aspectAwards(aspect),
    criterionId: aspect.criterionId,
    kind: "aspect",
    text: aspect.description,
  }));

  return [...criteria, ...aspects];
}

export function getWritingGraderSheet(basis: SheetBasis) {
  const { conventions = [], limits = [], zeroing } = basis.grading;

  return {
    conventions: conventions.map(({ text }) => text),
    criteria: basis.criteria.map(({ id, name }) => ({ id, text: name })),
    limits: limits.map(({ criteria, max, text }) => ({ criteria, max, text })),
    rows: listWritingRows(basis).map(({ aspect: _aspect, kind: _kind, ...row }) => row),
    zeroing: zeroing.map(({ kinds, maxLines, text }) => ({ kinds, maxLines, text })),
  };
}
