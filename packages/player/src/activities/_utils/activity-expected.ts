import {
  type ActivityExpected,
  type ActivityExpectedAnswer,
} from "@zoonk/core/library/activities/expected-answer";

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
