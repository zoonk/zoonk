import { type ExamStructure } from "./blueprint-contract";

type ExamFormat = ExamStructure["formats"][number];

/** A format answered by picking: one right option, or an assertion judged right or wrong. */
export type ExamChoiceFormat = ExamFormat & { kind: "multipleChoice" | "trueFalse" };

function isChoiceFormat(format: ExamFormat): format is ExamChoiceFormat {
  return format.kind === "multipleChoice" || format.kind === "trueFalse";
}

/**
 * How an exam asks the questions a learner answers by picking: the first choice format its notice
 * lists, such as ENEM's five options or Cebraspe's assertions judged right or wrong (Certo ou
 * Errado). Null when the notice lists none, like an essay-only exam or a blueprint without formats.
 */
export function getExamChoiceFormat(
  structure: Pick<ExamStructure, "formats"> | null,
): ExamChoiceFormat | null {
  return structure?.formats.find((format) => isChoiceFormat(format)) ?? null;
}
