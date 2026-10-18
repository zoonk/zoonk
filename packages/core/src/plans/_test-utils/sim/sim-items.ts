import { type ItemFormat } from "@zoonk/db";
import { type ExamChoiceFormat } from "../../../library/exams/exam-choice-format";
import { type RuleAnswer } from "../rules/rule-context";

/** The format of the exam's choice questions: Cebraspe's statements, or options. */
export function toSimItemFormat(choice: ExamChoiceFormat | null): "multipleChoice" | "trueFalse" {
  return choice?.kind === "trueFalse" ? "trueFalse" : "multipleChoice";
}

/** An answer's format as the checks weigh it: a true-or-false guess says less (`RuleAnswer`). */
export function toRuleFormat(format: ItemFormat): RuleAnswer["format"] {
  return format === "trueFalse" ? "trueFalse" : "other";
}
