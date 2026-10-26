import { isRoundedAnswer } from "@zoonk/utils/rounded-answer";
import { type ActivityAnswer } from "./activity-answer-schema";
import { type ActivityStepContent, getActivityTemplate } from "./activity-templates";
import { matchesExpectedAnswer } from "./templates/_utils/grade-interaction";
import { withinTolerance } from "./templates/_utils/pattern-checks";

/**
 * Grades a learner's answer to an activity with the same computed answer the validator checked
 * before publishing, so the player and the server can't disagree about what is right. A typed
 * number is right within the check's tolerance or rounded to the places the learner typed ("12"
 * for 11.88%), since a check stores no precision to hold the learner to.
 */
export function checkActivityAnswer(content: ActivityStepContent, answer: ActivityAnswer): boolean {
  const { check } = content;

  if (check.kind === "choice") {
    return (
      answer.kind === "choice" &&
      check.options.some((option) => option.id === answer.optionId && option.isCorrect)
    );
  }

  const template = getActivityTemplate(content.template);

  if (check.kind === "numeric") {
    const tolerances = [check.tolerance, template?.minTolerance].filter(
      (item) => item !== undefined,
    );

    return (
      answer.kind === "numeric" &&
      (tolerances.some((tolerance) =>
        withinTolerance({ expected: check.answer, tolerance, value: answer.value }),
      ) ||
        isRoundedAnswer({ expected: check.answer, value: answer.value }))
    );
  }

  const expected = template?.computeExpected(content.fields) ?? null;

  return expected !== null && matchesExpectedAnswer(expected, answer);
}
