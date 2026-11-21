import { type WritingResult } from "@zoonk/core/exams/essays/writing-contract";

type GradedStep = NonNullable<WritingResult["nextStep"]> & {
  /** What the grader asks to change. `limit` and `zero` are worded by the app. */
  kind?: "criterion" | "limit" | "zero";
  /** The change itself in a few words, written by the grader. Older answers have none. */
  title?: string | null;
};

export type NextStep =
  | { kind: "done" }
  | { kind: "limit" }
  | {
      example: string | null;
      kind: "criterion" | "zero";
      quote: string | null;
      text: string;
      title: string | null;
    };

/** With points, full marks on every row; with levels, every criterion complete. */
function isComplete(grade: WritingResult): boolean {
  if (grade.kind === "points") {
    return (
      grade.zeroReason === null &&
      grade.rows.every((row) => (row.range?.low ?? row.earned) >= row.max)
    );
  }

  return grade.criteria.every(({ level }) => level === "complete");
}

/** The first criterion still short of complete, for answers graded before the grader always named one. */
function weakestCriterion(grade: WritingResult): NextStep {
  const criterion = grade.criteria.find(({ level }) => level !== "complete");

  return {
    example: null,
    kind: "criterion",
    quote: null,
    text: criterion?.comment ?? "",
    title: criterion?.name ?? null,
  };
}

/**
 * The one thing to work on next. "Nothing left" only when every criterion is complete and every
 * line is read; text past the limit is the step when nothing else is. A quote is shown only when
 * it's in the text, where it's underlined.
 */
export function getNextStep({ grade, text }: { grade: WritingResult; text: string }): NextStep {
  const step: GradedStep | null = grade.nextStep;

  if (step?.kind === "limit" || (grade.ignoredFrom !== null && isComplete(grade))) {
    return { kind: "limit" };
  }

  if (!step) {
    return isComplete(grade) ? { kind: "done" } : weakestCriterion(grade);
  }

  const criterion = grade.criteria.find(({ id }) => id === step.criterionId);

  return {
    example: step.example,
    kind: step.kind === "zero" ? "zero" : "criterion",
    quote: step.quote && text.includes(step.quote) ? step.quote : null,
    text: step.text,
    title: step.title ?? (step.kind === "zero" ? null : (criterion?.name ?? null)),
  };
}
