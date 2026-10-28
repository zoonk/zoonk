import { type NumericEntry, type OptionSelect } from "@zoonk/ai/tasks/v2/items/schemas";
import { type ExamStructure } from "../library/exams/blueprint-contract";
import { ANY_NUMBER } from "../library/items/_utils/numeric-entry";

export type ExamAnswerFormat =
  | { entry: null; format: "multipleChoice"; select: OptionSelect }
  | { entry: NumericEntry; format: "numeric"; select: null };

function isSameAnswerFormat(a: ExamAnswerFormat, b: ExamAnswerFormat): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Excludes quick single-pick/true-false formats; unspecified numeric entries accept any number within tolerance. */
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
