import { type ActivityAnswer } from "./activity-answer-schema";
import { type ActivityStepContent, getActivityTemplate } from "./activity-templates";
import { matchesExpectedAnswer } from "./templates/_utils/grade-interaction";
import { withinTolerance } from "./templates/_utils/pattern-checks";

/**
 * Grades a learner's answer to an activity with the same computed answer the validator checked
 * before publishing, so the player and the server can't disagree about what is right.
 */
export function checkActivityAnswer(content: ActivityStepContent, answer: ActivityAnswer): boolean {
  const { check } = content;

  if (check.kind === "choice") {
    return (
      answer.kind === "choice" &&
      check.options.some((option) => option.id === answer.optionId && option.isCorrect)
    );
  }

  if (check.kind === "numeric") {
    return (
      answer.kind === "numeric" &&
      withinTolerance({ expected: check.answer, tolerance: check.tolerance, value: answer.value })
    );
  }

  const expected = getActivityTemplate(content.template)?.computeExpected(content.fields) ?? null;

  return expected !== null && matchesExpectedAnswer(expected, answer);
}
