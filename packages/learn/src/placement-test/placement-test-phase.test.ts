import { describe, expect, test } from "vitest";
import {
  type PlacementAttemptView,
  type PlacementOutcome,
  type PlacementQuestion,
} from "../onboarding/onboarding-actions";
import { toFinishedPhase, toPlacementTestPhase } from "./placement-test-phase";

const ATTEMPT: PlacementAttemptView = {
  estimatedMinutes: 20,
  id: "0198a6c4-2f6e-7c1a-9b1e-3f2d4c5b6a71",
  length: "wholeCourse",
  part: 1,
  partComplete: false,
};

const QUESTION: PlacementQuestion = {
  context: null,
  format: "matchPairs",
  image: null,
  itemId: "0198a6c4-2f6e-7c1a-9b1e-3f2d4c5b6a72",
  left: ["a", "b", "c", "d"],
  options: null,
  question: "Match them",
  right: ["1", "2", "3", "4"],
  skillId: "0198a6c4-2f6e-7c1a-9b1e-3f2d4c5b6a73",
  visual: null,
};

function ready(
  attempt: PlacementAttemptView | null,
  next: PlacementQuestion | null,
): PlacementOutcome {
  return {
    answered: 3,
    attempt,
    complete: false,
    dayBudgetSpent: 0.25,
    dayBudgetUsed: false,
    focusTest: null,
    next,
    result: null,
    started: true,
    status: "ready",
    trueFalseLabels: "trueFalse",
  };
}

describe(toPlacementTestPhase, () => {
  test("with no test open, the learner chooses how much to check, whatever onboarding's state", () => {
    expect(toPlacementTestPhase(ready(null, QUESTION))).toStrictEqual({ kind: "choose" });
    expect(toPlacementTestPhase({ status: "unavailable" })).toStrictEqual({ kind: "choose" });
  });

  test("an open test goes on at its next question", () => {
    expect(toPlacementTestPhase(ready(ATTEMPT, QUESTION))).toMatchObject({
      answered: 3,
      kind: "question",
      progress: 0.25,
      question: QUESTION,
    });
  });

  test("an open test waits while its questions are written", () => {
    expect(
      toPlacementTestPhase({ attempt: ATTEMPT, focusTest: null, status: "notReady" }),
    ).toStrictEqual({ kind: "waiting" });
  });

  test("a part with nothing left to ask closes next", () => {
    expect(toPlacementTestPhase(ready(ATTEMPT, null))).toStrictEqual({
      attempt: ATTEMPT,
      kind: "partOver",
    });
  });

  test("a part closed earlier offers the next one", () => {
    const closed = { ...ATTEMPT, partComplete: true };

    expect(toPlacementTestPhase(ready(closed, null))).toStrictEqual({
      attempt: closed,
      kind: "between",
      lessonsSkipped: null,
    });
  });
});

describe(toFinishedPhase, () => {
  test("a whole-course part with more to check says what it skipped and what's left", () => {
    const next = { ...ATTEMPT, estimatedMinutes: 12, partComplete: true };

    expect(
      toFinishedPhase({
        finished: {
          attempt: next,
          lessonsSkipped: 6,
          nextTopic: null,
          result: null,
          status: "finished",
        },
        length: "wholeCourse",
      }),
    ).toStrictEqual({ attempt: next, kind: "between", lessonsSkipped: 6 });
  });

  test("the last part shows the whole test's result", () => {
    expect(
      toFinishedPhase({
        finished: {
          attempt: null,
          lessonsSkipped: 2,
          nextTopic: "Compound interest",
          result: {
            attemptId: ATTEMPT.id,
            finishedAt: "2026-11-21T12:00:00.000Z",
            lessonsSkipped: 9,
          },
          status: "finished",
        },
        length: "wholeCourse",
      }),
    ).toStrictEqual({
      kind: "result",
      length: "wholeCourse",
      lessonsSkipped: 9,
      nextTopic: "Compound interest",
    });
  });
});
