import {
  type FocusTestOffer,
  type FocusTestSitting,
  type FocusTestView,
} from "@zoonk/core/learner/placement/focus-test-contract";
import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { type PlacementOutcome, type PlacementQuestion } from "../onboarding/onboarding-actions";

export type QuestionPhase = {
  failures: number;
  kind: "question";
  question: PlacementQuestion;
  sitting: FocusTestSitting;
  trueFalseLabels: TrueFalseLabels;
};

export type FocusTestPhase =
  | QuestionPhase
  /** `ended`: the open sitting asks nothing more and isn't closed yet. */
  | { kind: "ended" | "loadFailed" | "loading" | "unavailable" }
  /** `answered`: the learner has test answers, so leaving the wait uses them. */
  | { answered: boolean; kind: "waiting" }
  | { focusTest: FocusTestView; kind: "invitation"; next: FocusTestOffer }
  /** `answered`: every answer the learner has saved, earlier sittings included. */
  | { answered: number; kind: "resume"; question: QuestionPhase }
  | { focusTest: FocusTestView; kind: "checkpoint" };

/** Null when there's no result to show and nothing to offer. */
function toRestingPhase(focusTest: FocusTestView): FocusTestPhase | null {
  if (focusTest.checkpoint) {
    return { focusTest, kind: "checkpoint" };
  }

  return focusTest.offer && { focusTest, kind: "invitation", next: focusTest.offer };
}

/**
 * `opening` is a page load, which never drops the learner into a question: a sitting with answers
 * shows its resume screen, and one without is offered again, unless the learner `started` it on the
 * screen that led here. A test with no result and nothing to ask is `unavailable`, and a read that
 * failed is `loadFailed`.
 */
export function toFocusTestPhase({
  opening,
  outcome,
  started = false,
}: {
  opening: boolean;
  outcome: PlacementOutcome;
  started?: boolean;
}): FocusTestPhase {
  if (outcome.status === "failed") {
    return { kind: "loadFailed" };
  }

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
    return { kind: "ended" };
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

  if (sitting.answered > 0) {
    return { answered: outcome.answered, kind: "resume", question };
  }

  return started ? question : (toRestingPhase(focusTest) ?? question);
}
