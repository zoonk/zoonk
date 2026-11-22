import { type WritingResult } from "@zoonk/core/exams/essays/writing-contract";

type ZeroKind = Extract<WritingResult, { kind: "points" }>["zeroKind"];

export type NextStep =
  | { kind: "done" }
  | { kind: "limit" }
  | { kind: "short" }
  | { kind: "zero"; text: string; zeroKind: ZeroKind }
  | {
      example: string | null;
      kind: "criterion";
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
 * line is read; a zeroed answer's step is the rule it broke; text past the limit is the step when
 * nothing else is. A quote is shown only when it's in the text, where it's underlined. Older saved
 * answers have no `kind` or `title`, so the same rules read them.
 */
export function getNextStep({ grade, text }: { grade: WritingResult; text: string }): NextStep {
  const step = grade.nextStep;
  const kind = step?.kind;

  if (kind === "zero" || (grade.kind === "points" && grade.zeroReason !== null)) {
    return {
      kind: "zero",
      text: step?.text ?? "",
      zeroKind: grade.kind === "points" ? grade.zeroKind : undefined,
    };
  }

  if (kind === "short" || kind === "limit") {
    return { kind };
  }

  if (grade.ignoredFrom !== null && isComplete(grade)) {
    return { kind: "limit" };
  }

  if (!step) {
    return isComplete(grade) ? { kind: "done" } : weakestCriterion(grade);
  }

  const criterion = grade.criteria.find(({ id }) => id === step.criterionId);

  return {
    example: step.example,
    kind: "criterion",
    quote: step.quote && text.includes(step.quote) ? step.quote : null,
    text: step.text,
    title: step.title ?? criterion?.name ?? null,
  };
}
