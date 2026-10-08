import { type ItemFormat } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type ExamStructure } from "./blueprint-contract";

type ExamFormat = ExamStructure["formats"][number];

/** A format answered by picking: one right option, or an assertion judged right or wrong. */
export type ExamChoiceFormat = ExamFormat & { kind: "multipleChoice" | "trueFalse" };

function isChoiceFormat(format: ExamFormat): format is ExamChoiceFormat {
  return format.kind === "multipleChoice" || format.kind === "trueFalse";
}

type FormatsOf = Pick<ExamStructure, "formats" | "pastOptions">;

/**
 * The exam's formats as questions are written and picked by: a multiple-choice format whose notice
 * doesn't say how many options it has takes the number its latest edition had (`pastOptions`).
 */
export function getExamFormats(structure: FormatsOf): ExamFormat[] {
  const pastOptions = structure.pastOptions?.options ?? null;

  return structure.formats.map((format) =>
    format.kind === "multipleChoice" && format.options === null && pastOptions !== null
      ? { ...format, options: pastOptions }
      : format,
  );
}

/**
 * How an exam asks the questions a learner answers by picking: the first choice format its notice
 * lists, such as ENEM's five options or Cebraspe's assertions judged right or wrong (Certo ou
 * Errado), with its number of options (`getExamFormats`). Null when the notice lists none, like an
 * essay-only exam or a blueprint without formats.
 */
export function getExamChoiceFormat(structure: FormatsOf | null): ExamChoiceFormat | null {
  return structure
    ? (getExamFormats(structure).find((format) => isChoiceFormat(format)) ?? null)
    : null;
}

function countOptions(content: unknown): number | null {
  return isJsonObject(content) && Array.isArray(content.options) ? content.options.length : null;
}

type ChoiceFit = {
  choice: ExamChoiceFormat | null;
  item: { content: unknown; format: ItemFormat };
};

/**
 * Whether a question in the exam's own choice kind has the exam's number of options: a five-option
 * exam (ENEM) never asks a four-option question, wherever it's asked. Questions in other formats,
 * and any question for a goal without an exam's count, fit.
 */
export function fitsExamOptions({ choice, item }: ChoiceFit): boolean {
  return (
    choice?.kind !== "multipleChoice" ||
    !choice.options ||
    item.format !== "multipleChoice" ||
    countOptions(item.content) === choice.options
  );
}

/**
 * Whether a placement question looks like the exam's own: a typed one confirms any skill, and a
 * quick one is in the exam's choice format, with its number of options (`fitsExamOptions`). A
 * Certo-or-Errado exam never asks multiple choice, and a five-option exam never asks four. Any
 * question fits a goal without an exam's choice format (`choice` null).
 */
export function fitsExamChoice({ choice, item }: ChoiceFit): boolean {
  if (!choice || item.format === "typed") {
    return true;
  }

  return item.format === choice.kind && fitsExamOptions({ choice, item });
}
