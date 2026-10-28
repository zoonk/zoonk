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

export function expectedInteraction<TKind extends ActivityExpectedAnswer["kind"]>(
  expected: ActivityExpected | null,
  kind: TKind,
): ExpectedOfKind<TKind> | null {
  return expected?.kind === "interaction" && hasKind(expected.answer, kind)
    ? expected.answer
    : null;
}

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
