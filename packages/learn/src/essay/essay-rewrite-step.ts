import { type EssayDraft } from "@zoonk/core/exams/essays/contract";

type Grade = EssayDraft["grade"];

export type RewriteStep =
  | { criterion: Grade["criteria"][number] | null; kind: "nextStep"; text: string }
  | { kind: "fullMarks" }
  | { kind: "tooShort" };

// Core still names a criterion for a too-short essay, but no model graded it, so its step is empty.
export function rewriteStep(grade: Grade): RewriteStep {
  if (grade.zeroReason === "tooShort") {
    return { kind: "tooShort" };
  }

  const { nextStep } = grade;

  if (!nextStep) {
    return { kind: "fullMarks" };
  }

  return {
    criterion: grade.criteria.find((item) => item.id === nextStep.criterionId) ?? null,
    kind: "nextStep",
    text: nextStep.text,
  };
}
