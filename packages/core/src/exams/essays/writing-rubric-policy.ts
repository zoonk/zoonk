import { ENEM_WRITING_MAX, hasEnemCompetences } from "./_utils/enem-writing";
import { passedWritingEvaluations } from "./_utils/writing-rubric-evaluations";
import { getWritingRounding, getWritingRubricFingerprint } from "./_utils/writing-task-basis";

export type WritingArithmetic = {
  rounding: { mode: "nearest" | "down"; places: number } | null;
  zeroRules: readonly number[];
};

type Basis = Parameters<typeof getWritingRubricFingerprint>[0];

export function supportsWritingArithmetic(
  { language, rounding }: Basis["grading"],
  arithmetic: WritingArithmetic,
) {
  const rule = getWritingRounding(rounding);
  const rounds = Boolean(rounding) && (typeof rule !== "object" || rule?.mode !== "none");

  return (
    rounds === Boolean(arithmetic.rounding) &&
    (!language || (language.method !== "other" && language.factor !== null && language.formula))
  );
}

export function getWritingArithmetic(
  basis: Basis,
  observed?: { model: string; promptVersion: string },
): WritingArithmetic | null {
  const { grading, points } = basis;
  const { criteria, kind } = grading;
  const rounding = getWritingRounding(grading.rounding);

  if (
    points === null ||
    kind === "levels" ||
    rounding === "unknown" ||
    (kind === "enem"
      ? points !== ENEM_WRITING_MAX || !hasEnemCompetences(criteria)
      : criteria.length === 0)
  ) {
    return null;
  }

  const passed = passedWritingEvaluations[getWritingRubricFingerprint(basis)];

  if (
    !passed ||
    passed.kind !== kind ||
    !supportsWritingArithmetic(grading, passed.arithmetic) ||
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
