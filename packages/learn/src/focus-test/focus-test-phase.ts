import {
  type FocusTestOffer,
  type FocusTestSitting,
  type FocusTestView,
} from "@zoonk/core/learner/placement/focus-test-contract";
import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { type PlacementOutcome, type PlacementQuestion } from "../onboarding/onboarding-actions";

export type SittingEnd = NonNullable<FocusTestSitting["end"]>;

/** What Start or Continue the test opens: its count and its time, said before the tap. */
export type NextSitting = Pick<FocusTestOffer, "minutes" | "pastCeiling" | "questions">;

export type QuestionPhase = {
  failures: number;
  kind: "question";
  question: PlacementQuestion;
  sitting: FocusTestSitting;
  trueFalseLabels: TrueFalseLabels;
};

export type FocusTestPhase =
  | QuestionPhase
  | { kind: "loading" | "unavailable" }
  /** `answered`: the learner has test answers, so leaving the wait uses them. */
  | { answered: boolean; kind: "waiting" }
  | { focusTest: FocusTestView; kind: "invitation"; next: NextSitting }
  | { kind: "resume"; question: QuestionPhase }
  | { end: SittingEnd | null; kind: "ended" }
  | { end: SittingEnd | null; focusTest: FocusTestView; kind: "checkpoint" };

/** A sitting opened and left before its first answer is offered again, with its own numbers. */
export function getNextSitting(focusTest: FocusTestView): NextSitting | null {
  const { offer, sitting } = focusTest;

  if (offer) {
    return offer;
  }

  return sitting && sitting.answered === 0 && sitting.left > 0
    ? { minutes: sitting.minutes, pastCeiling: 0, questions: sitting.questions }
    : null;
}

/** Null when there's no result to show and nothing to offer. */
function toRestingPhase(focusTest: FocusTestView): FocusTestPhase | null {
  if (focusTest.checkpoint) {
    return { end: null, focusTest, kind: "checkpoint" };
  }

  const next = getNextSitting(focusTest);
  return next && { focusTest, kind: "invitation", next };
}

/**
 * `opening` is a page load, which never drops the learner into a question: a sitting with answers
 * shows its resume screen, and one without is offered again. A test with no result and nothing to
 * ask is `unavailable`.
 */
export function toFocusTestPhase({
  opening,
  outcome,
}: {
  opening: boolean;
  outcome: PlacementOutcome;
}): FocusTestPhase {
  if (outcome.status === "unavailable") {
    return { kind: "unavailable" };
  }

  if (outcome.status !== "ready") {
    const focusTest = outcome.status === "notReady" ? outcome.focusTest : null;
    const resting = opening && focusTest && !focusTest.sitting ? toRestingPhase(focusTest) : null;
    return resting ?? { answered: Boolean(focusTest?.checkpoint), kind: "waiting" };
  }

  const { focusTest, next } = outcome;

  if (!focusTest) {
    return { kind: "unavailable" };
  }

  const { sitting } = focusTest;

  if (!sitting) {
    return toRestingPhase(focusTest) ?? { kind: "unavailable" };
  }

  if (!next) {
    return { end: sitting.end, kind: "ended" };
  }

  const question: QuestionPhase = {
    failures: 0,
    kind: "question",
    question: next,
    sitting,
    trueFalseLabels: outcome.trueFalseLabels,
  };

  if (!opening) {
    return question;
  }

  return sitting.answered > 0
    ? { kind: "resume", question }
    : (toRestingPhase(focusTest) ?? question);
}
