import {
  type FocusTestSitting,
  type FocusTestView,
} from "@zoonk/core/learner/placement/focus-test-contract";
import { describe, expect, it } from "vitest";
import { type PlacementOutcome, type PlacementQuestion } from "../onboarding/onboarding-actions";
import { toFocusTestPhase } from "./focus-test-phase";

const QUESTION: PlacementQuestion = {
  context: null,
  format: "multipleChoice",
  image: null,
  itemId: "item-1",
  options: ["A", "B"],
  question: "Which one?",
  skillId: "skill-1",
  visual: null,
};

const OFFER = { minutes: 15 };

function sittingWith(sitting: Partial<FocusTestSitting> = {}): FocusTestSitting {
  return {
    answered: 0,
    hint: null,
    minutes: 15,
    questions: 15,
    subject: { key: "law", name: "Administrative Law", shortName: null },
    ...sitting,
  };
}

function testWith(focusTest: Partial<FocusTestView> = {}): FocusTestView {
  return {
    checkpoint: null,
    offer: null,
    sessionQuestions: "off",
    sitting: null,
    subjects: [],
    suggestsFocus: true,
    ...focusTest,
  };
}

function ready(
  focusTest: FocusTestView | null,
  next: PlacementQuestion | null = null,
): PlacementOutcome {
  return {
    answered: 0,
    complete: false,
    dayBudgetSpent: 0,
    dayBudgetUsed: false,
    focusTest,
    next,
    started: false,
    status: "ready",
    trueFalseLabels: "trueFalse",
  };
}

const CHECKPOINT = { focus: null, lessonsSkipped: 3 };

describe(toFocusTestPhase, () => {
  it("invites a learner who hasn't started, with the sitting it would open", () => {
    const focusTest = testWith({ offer: OFFER });

    expect(toFocusTestPhase({ opening: true, outcome: ready(focusTest) })).toStrictEqual({
      focusTest,
      kind: "invitation",
      next: OFFER,
    });
  });

  it("shows the result once the learner has answers and no sitting is open", () => {
    const focusTest = testWith({ checkpoint: CHECKPOINT, offer: OFFER });

    expect(toFocusTestPhase({ opening: true, outcome: ready(focusTest) })).toStrictEqual({
      focusTest,
      kind: "checkpoint",
    });
  });

  it("asks the next question right after a start or an answer", () => {
    const sitting = sittingWith({ answered: 6, minutes: 9 });
    const outcome = ready(testWith({ checkpoint: CHECKPOINT, sitting }), QUESTION);

    expect(toFocusTestPhase({ opening: false, outcome })).toStrictEqual({
      failures: 0,
      kind: "question",
      question: QUESTION,
      sitting,
      trueFalseLabels: "trueFalse",
    });
  });

  it("never opens a page on a question: a sitting with answers waits on its resume screen", () => {
    const sitting = sittingWith({ answered: 6, minutes: 9 });
    const outcome = ready(testWith({ checkpoint: CHECKPOINT, sitting }), QUESTION);

    expect(toFocusTestPhase({ opening: true, outcome })).toMatchObject({
      kind: "resume",
      question: { kind: "question", question: QUESTION, sitting },
    });
  });

  it("invites again when a sitting was left before its first answer", () => {
    const focusTest = testWith({ offer: OFFER, sitting: sittingWith() });

    expect(toFocusTestPhase({ opening: true, outcome: ready(focusTest, QUESTION) })).toStrictEqual({
      focusTest,
      kind: "invitation",
      next: OFFER,
    });
  });

  it("ends a sitting that has nothing more to ask", () => {
    const sitting = sittingWith({ answered: 6, minutes: 9, subject: null });
    const outcome = ready(testWith({ checkpoint: CHECKPOINT, sitting }));

    expect(toFocusTestPhase({ opening: false, outcome })).toStrictEqual({ kind: "ended" });
  });

  it("waits while questions are being written, and says whether there are answers to use", () => {
    const focusTest = testWith({ checkpoint: CHECKPOINT, sitting: sittingWith({ answered: 2 }) });

    expect(
      toFocusTestPhase({ opening: true, outcome: { focusTest, status: "notReady" } }),
    ).toStrictEqual({ answered: true, kind: "waiting" });

    expect(
      toFocusTestPhase({ opening: true, outcome: { focusTest: null, status: "notReady" } }),
    ).toStrictEqual({ answered: false, kind: "waiting" });
  });

  it("says a read that failed couldn't open the test, never that questions are being written", () => {
    expect(toFocusTestPhase({ opening: true, outcome: { status: "failed" } })).toStrictEqual({
      kind: "loadFailed",
    });
  });

  it("still invites while the plan is being written, when the sitting's size is known", () => {
    const focusTest = testWith({ offer: OFFER });

    expect(
      toFocusTestPhase({ opening: true, outcome: { focusTest, status: "notReady" } }),
    ).toMatchObject({ kind: "invitation" });
  });

  it("has nothing to show for a goal with no test, or a test with nothing to ask", () => {
    expect(toFocusTestPhase({ opening: true, outcome: ready(null) })).toStrictEqual({
      kind: "unavailable",
    });

    expect(toFocusTestPhase({ opening: true, outcome: ready(testWith()) })).toStrictEqual({
      kind: "unavailable",
    });
  });
});
