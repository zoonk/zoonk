import { type ItemFormat } from "@zoonk/db";
import { choiceItemContent } from "@zoonk/testing/fixtures/skills";
import { type ExamChoiceFormat } from "../../../library/exams/exam-choice-format";
import { type RuleAnswer } from "../rules/rule-context";

/**
 * The database tier's bank questions, in the exam's own choice format as its writers write them
 * (ENEM's five options, OAB's four, Cebraspe's statements judged right or wrong), so placement,
 * practice and mocks pick them as they would the real bank's. Every statement is true and every
 * question's first option is the right one.
 */

/** How long the simulated learner takes on a question. */
export const SIM_ANSWER_MS = 4000;

const RIGHT_OPTION = 0;
const WRONG_OPTION = 1;

/** A goal without an exam's number of options asks a right option and a wrong one. */
const DEFAULT_OPTIONS = 2;

/** The format of the exam's choice questions: Cebraspe's statements, or options. */
export function toSimItemFormat(choice: ExamChoiceFormat | null): "multipleChoice" | "trueFalse" {
  return choice?.kind === "trueFalse" ? "trueFalse" : "multipleChoice";
}

/** A bank question in the exam's choice format. */
export function toSimItem({
  choice,
  question,
}: {
  choice: ExamChoiceFormat | null;
  question: string;
}) {
  if (toSimItemFormat(choice) === "trueFalse") {
    return {
      content: {
        context: null,
        isTrue: true,
        misconception: null,
        reason: "It follows the rule.",
        statement: question,
      },
      format: "trueFalse" as const,
    };
  }

  const { options, ...content } = choiceItemContent(question);
  const wrongCount = (choice?.options ?? DEFAULT_OPTIONS) - 1;

  // The fixture's one wrong option, as many times as the exam has wrong ones.
  const wrongs = options
    .filter((option) => !option.isCorrect)
    .flatMap((wrong) =>
      Array.from({ length: wrongCount }, (_, index) => ({
        ...wrong,
        text: `Wrong answer ${index + 1}`,
      })),
    );

  return {
    content: { ...content, options: [...options.filter((option) => option.isCorrect), ...wrongs] },
    format: "multipleChoice" as const,
  };
}

/** The learner's answer to a bank question, right or wrong, in its format. */
export function toSimAnswer({
  correct,
  format,
}: {
  correct: boolean;
  format: ItemFormat;
}): { isTrue: boolean } | { selectedIndex: number } {
  return format === "trueFalse"
    ? { isTrue: correct }
    : { selectedIndex: correct ? RIGHT_OPTION : WRONG_OPTION };
}

/** An answer's format as the checks weigh it: a true-or-false guess says less (`RuleAnswer`). */
export function toRuleFormat(format: ItemFormat): RuleAnswer["format"] {
  return format === "trueFalse" ? "trueFalse" : "other";
}
