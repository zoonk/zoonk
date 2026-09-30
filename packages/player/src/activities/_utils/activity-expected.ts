import { type ActivityExpectedAnswer } from "@zoonk/core/library/activities/expected-answer";
import {
  type ActivityStepContent,
  getActivityTemplate,
} from "@zoonk/core/library/activities/templates";
import { type ActivityExpected } from "../activity-renderer";

type ExpectedOfKind<TKind extends ActivityExpectedAnswer["kind"]> = Extract<
  ActivityExpectedAnswer,
  { kind: TKind }
>;

function hasKind<TKind extends ActivityExpectedAnswer["kind"]>(
  answer: ActivityExpectedAnswer,
  kind: TKind,
): answer is ExpectedOfKind<TKind> {
  return answer.kind === kind;
}

/**
 * The interaction's expected end state when it has the kind a renderer draws (an assignment,
 * an order, rows...), or null before the check.
 */
export function expectedInteraction<TKind extends ActivityExpectedAnswer["kind"]>(
  expected: ActivityExpected | null,
  kind: TKind,
): ExpectedOfKind<TKind> | null {
  return expected?.kind === "interaction" && hasKind(expected.answer, kind)
    ? expected.answer
    : null;
}

/**
 * The correct answer shown after the check, taken from the same values the server grades with
 * (see `checkActivityAnswer`), so the canvas can never show a different answer than the grade.
 */
export function getActivityExpected(content: ActivityStepContent): ActivityExpected | null {
  const { check } = content;

  if (check.kind === "choice") {
    const correct = check.options.find((option) => option.isCorrect);
    return correct ? { kind: "choice", optionId: correct.id } : null;
  }

  if (check.kind === "numeric") {
    return { kind: "numeric", value: check.answer };
  }

  const answer = getActivityTemplate(content.template)?.computeExpected(content.fields) ?? null;

  return answer ? { answer, kind: "interaction" } : null;
}
