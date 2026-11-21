import { type z } from "zod";
import { ENEM_WRITING_MAX, hasEnemCompetences } from "./_utils/enem-writing";
import { getWritingRounding, getWritingRubricFingerprint } from "./_utils/writing-task-basis";
import { type writtenItemSchema } from "./writing-contract";

type Basis = Pick<z.infer<typeof writtenItemSchema>, "criteria" | "grading" | "points">;

export type WritingArithmetic = {
  rounding: { mode: "nearest" | "down"; places: number } | null;
  zeroRules: readonly number[];
};

type PassedEvaluation = {
  corpus: string;
  model: string;
  promptRevision: string;
  arithmetic: WritingArithmetic;
};

const passedEvaluations: Readonly<Record<string, PassedEvaluation>> = {};

export function getWritingArithmetic(
  basis: Basis,
  observed?: { model: string; promptVersion: string },
): WritingArithmetic | null {
  const { grading, points } = basis;

  if (
    points === null ||
    grading.kind === "levels" ||
    getWritingRounding(grading.rounding) === "unknown" ||
    (grading.kind === "enem"
      ? points !== ENEM_WRITING_MAX || !hasEnemCompetences(basis.criteria)
      : grading.criteria.length === 0)
  ) {
    return null;
  }

  const passed = passedEvaluations[getWritingRubricFingerprint(basis)];

  if (
    !passed ||
    (observed &&
      (passed.model !== observed.model || passed.promptRevision !== observed.promptVersion))
  ) {
    return null;
  }

  return passed.arithmetic;
}

export function isNumericWritingRubric(basis: Basis): boolean {
  return getWritingArithmetic(basis) !== null;
}
