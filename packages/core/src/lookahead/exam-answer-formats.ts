import { type NumericEntry, type OptionSelect } from "@zoonk/ai/tasks/v2/items/schemas";
import { type ExamStructure } from "../library/exams/blueprint-contract";
import { ANY_NUMBER } from "../library/items/_utils/numeric-entry";

/**
 * An objective format an exam asks beyond one quick pick, as its notice states it: several picks
 * of a multiple-choice question ("one or more correct"), or a number typed into an answer box (a
 * grid-in, an integer answer).
 */
export type ExamAnswerFormat =
  | { entry: null; format: "multipleChoice"; select: OptionSelect }
  | { entry: NumericEntry; format: "numeric"; select: null };

function isSameAnswerFormat(a: ExamAnswerFormat, b: ExamAnswerFormat): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The exam's answer formats beyond one quick pick, once each: placement and the bank's quick
 * questions cover one pick and true or false. A numeric format the notice doesn't detail takes any
 * number, graded by its tolerance.
 */
export function listExamAnswerFormats(
  structure: Pick<ExamStructure, "formats">,
): ExamAnswerFormat[] {
  const formats = structure.formats.flatMap((format): ExamAnswerFormat[] => {
    if (format.kind === "multipleChoice" && format.select && format.select !== 1) {
      return [{ entry: null, format: "multipleChoice", select: format.select }];
    }

    return format.kind === "numeric"
      ? [{ entry: format.entry ?? ANY_NUMBER, format: "numeric", select: null }]
      : [];
  });

  return formats.filter(
    (format, index) => formats.findIndex((other) => isSameAnswerFormat(format, other)) === index,
  );
}
