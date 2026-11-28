import { describe, expect, it } from "vitest";
import {
  type PlacementAttemptView,
  type PlacementOutcome,
  type PlacementQuestion,
  type PlacementResult,
} from "../onboarding/onboarding-actions";
import { type PlacementFinishOutcome } from "./placement-test-actions";
import { answerOrRead, toFinishedPhase, toPlacementTestPhase } from "./placement-test-phase";

const ATTEMPT_ID = "0198a6c4-2f6e-7c1a-9b1e-3f2d4c5b6a71";
const CHANGE_ID = "0198a6c4-2f6e-7c1a-9b1e-3f2d4c5b6a75";

const NEXT_LESSON = {
  chapter: "Loops",
  estimatedMinutes: 5,
  id: "0198a6c4-2f6e-7c1a-9b1e-3f2d4c5b6a76",
  title: "Loops with for",
};

const ATTEMPT: PlacementAttemptView = {
  answered: 4,
  chapter: "Variables and types",
  estimatedMinutes: 4,
  id: ATTEMPT_ID,
  length: "quick",
  part: 1,
  partComplete: false,
  questions: 8,
};

const COURSE = {
  chapters: [
    { done: 0, lessons: 3, skipped: 3, start: false },
    { done: 1, lessons: 4, skipped: 2, start: true },
    { done: 0, lessons: 2, skipped: 0, start: false },
  ],
  lessons: 9,
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

const RESULT: PlacementResult = {
  attemptId: ATTEMPT_ID,
  changeId: CHANGE_ID,
  chapter: "Loops",
  course: COURSE,
  finishedAt: "2026-11-26T12:00:00.000Z",
  lessonsSkipped: 5,
  nextLesson: NEXT_LESSON,
};

const RESULT_PHASE = {
  attemptId: ATTEMPT_ID,
  changeId: CHANGE_ID,
  chapter: "Loops",
  course: COURSE,
  heldUntilTomorrow: false,
  kind: "result",
  lessonsSkipped: 5,
  nextLesson: NEXT_LESSON,
};

function ready({
  attempt = null,
  next = null,
  result = null,
}: {
  attempt?: PlacementAttemptView | null;
  next?: PlacementQuestion | null;
  result?: PlacementResult | null;
}): PlacementOutcome {
  return { attempt, focusTest: null, next, result, status: "ready", trueFalseLabels: "trueFalse" };
}

function finished(
  outcome: Partial<Extract<PlacementFinishOutcome, { status: "finished" }>>,
): Extract<PlacementFinishOutcome, { status: "finished" }> {
  return { changeId: CHANGE_ID, lessonsSkipped: 5, result: RESULT, status: "finished", ...outcome };
}

describe(toPlacementTestPhase, () => {
  it("offers a test when none is open", () => {
    const outcome = ready({ next: QUESTION });

    for (const surface of ["plan", "onboarding"] as const) {
      expect(toPlacementTestPhase({ outcome, surface })).toStrictEqual({ kind: "offer" });
    }
  });

  it("opens the last test's result from the Plan, also when a new test could start", () => {
    const outcome = ready({ result: RESULT });

    expect(toPlacementTestPhase({ outcome, surface: "plan" })).toStrictEqual({
      ...RESULT_PHASE,
      saved: true,
    });

    expect(toPlacementTestPhase({ outcome, surface: "onboarding" })).toStrictEqual(RESULT_PHASE);
  });

  it("opens the saved result from the Plan when a test was taken and none is left to start", () => {
    expect(
      toPlacementTestPhase({
        canStart: false,
        outcome: { attempt: null, result: RESULT, status: "unavailable" },
        surface: "plan",
      }),
    ).toStrictEqual({ ...RESULT_PHASE, saved: true });
  });

  it("offers no start from the Plan when the course has no test to start and none was taken", () => {
    expect(
      toPlacementTestPhase({
        canStart: false,
        outcome: { attempt: null, result: null, status: "unavailable" },
        surface: "plan",
      }),
    ).toStrictEqual({ kind: "unavailable" });
  });

  it("shows the result of the test the learner was in when a read finds it closed, on the Plan too", () => {
    const outcome: PlacementOutcome = { attempt: null, result: RESULT, status: "unavailable" };

    expect(
      toPlacementTestPhase({ asked: true, attemptId: ATTEMPT_ID, outcome, surface: "plan" }),
    ).toStrictEqual(RESULT_PHASE);
  });

  it("doesn't take an earlier test's result for the one the learner was in", () => {
    const outcome: PlacementOutcome = { attempt: null, result: RESULT, status: "unavailable" };

    expect(
      toPlacementTestPhase({ asked: true, attemptId: CHANGE_ID, outcome, surface: "plan" }),
    ).toStrictEqual({ kind: "unavailable" });
  });

  it("shows onboarding a test's result read with nothing to ask", () => {
    const outcome: PlacementOutcome = { attempt: null, result: RESULT, status: "unavailable" };

    expect(toPlacementTestPhase({ outcome, surface: "onboarding" })).toStrictEqual(RESULT_PHASE);

    expect(toPlacementTestPhase({ outcome, surface: "plan" })).toStrictEqual({
      ...RESULT_PHASE,
      saved: true,
    });
  });

  it("waits for a test the learner asked for while the course's questions aren't there yet", () => {
    const cold: PlacementOutcome = { attempt: null, focusTest: null, status: "notReady" };

    expect(toPlacementTestPhase({ outcome: cold, surface: "onboarding" })).toStrictEqual({
      kind: "offer",
    });

    expect(
      toPlacementTestPhase({ asked: true, outcome: cold, surface: "onboarding" }),
    ).toStrictEqual({ kind: "waiting" });

    expect(
      toPlacementTestPhase({
        asked: true,
        outcome: { status: "generationFailed" },
        surface: "onboarding",
      }),
    ).toStrictEqual({ buildFailed: true, kind: "waiting" });
  });

  it("says there is nothing to test when an asked-for test has nothing to open", () => {
    expect(
      toPlacementTestPhase({ asked: true, outcome: ready({ next: QUESTION }), surface: "plan" }),
    ).toStrictEqual({ kind: "unavailable" });
  });

  it("goes on at the next question of an open sitting", () => {
    const outcome = ready({ attempt: ATTEMPT, next: QUESTION });

    expect(toPlacementTestPhase({ outcome, surface: "plan" })).toStrictEqual({
      attempt: ATTEMPT,
      failures: 0,
      kind: "question",
      question: QUESTION,
      trueFalseLabels: "trueFalse",
    });
  });

  it("waits while an open test's questions are being written", () => {
    const outcome: PlacementOutcome = { attempt: ATTEMPT, focusTest: null, status: "notReady" };

    expect(toPlacementTestPhase({ outcome, surface: "plan" })).toStrictEqual({ kind: "waiting" });
  });

  it("keeps the wait open for a retry when a test's questions couldn't be written", () => {
    const outcome: PlacementOutcome = { attempt: ATTEMPT, status: "generationFailed" };

    expect(toPlacementTestPhase({ outcome, surface: "onboarding" })).toStrictEqual({
      kind: "waiting",
      retry: true,
    });
  });

  it("says a started test has nothing to ask instead of offering it again", () => {
    const outcome: PlacementOutcome = { attempt: ATTEMPT, status: "unavailable" };

    expect(toPlacementTestPhase({ outcome, surface: "plan" })).toStrictEqual({
      kind: "unavailable",
    });
  });

  it("closes a test that has nothing more to ask", () => {
    const outcome = ready({ attempt: ATTEMPT });

    expect(toPlacementTestPhase({ outcome, surface: "plan" })).toStrictEqual({
      attempt: ATTEMPT,
      kind: "over",
    });
  });

  it("says a read that failed couldn't open the test", () => {
    expect(toPlacementTestPhase({ outcome: { status: "failed" }, surface: "plan" })).toStrictEqual({
      kind: "loadFailed",
    });
  });
});

describe(toFinishedPhase, () => {
  it("ends the test at its result, with the course's line and the lesson that's next", () => {
    expect(toFinishedPhase({ attemptId: ATTEMPT_ID, finished: finished({}) })).toStrictEqual(
      RESULT_PHASE,
    );
  });

  it("offers no Undo when nothing was skipped", () => {
    const phase = toFinishedPhase({
      attemptId: ATTEMPT_ID,
      finished: finished({ lessonsSkipped: 0, result: { ...RESULT, lessonsSkipped: 0 } }),
    });

    expect(phase).toMatchObject({ changeId: null, kind: "result", lessonsSkipped: 0 });
  });

  it("says only how much was skipped when the finish carries no result", () => {
    const phase = toFinishedPhase({
      attemptId: ATTEMPT_ID,
      finished: finished({ lessonsSkipped: 2, result: null }),
    });

    expect(phase).toStrictEqual({
      attemptId: ATTEMPT_ID,
      changeId: CHANGE_ID,
      chapter: null,
      course: null,
      heldUntilTomorrow: false,
      kind: "result",
      lessonsSkipped: 2,
      nextLesson: null,
    });
  });

  it("carries a skip held until tomorrow", () => {
    const phase = toFinishedPhase({
      attemptId: ATTEMPT_ID,
      finished: finished({
        heldUntilTomorrow: true,
        lessonsSkipped: 0,
        result: { ...RESULT, heldUntilTomorrow: true, lessonsSkipped: 0 },
      }),
    });

    expect(phase).toMatchObject({ changeId: null, heldUntilTomorrow: true, lessonsSkipped: 0 });
  });
});

describe(answerOrRead, () => {
  const OTHER = { ...QUESTION, itemId: "0198a6c4-2f6e-7c1a-9b1e-3f2d4c5b6a77" };
  const FAILED: PlacementOutcome = { status: "failed" };
  const moved = ready({ attempt: { ...ATTEMPT, answered: 5 }, next: OTHER });

  it("takes where a saved answer leaves the test, without reading it again", async () => {
    let reads = 0;

    const outcome = await answerOrRead({
      answer: async () => moved,
      question: QUESTION,
      read: async () => {
        reads += 1;
        return moved;
      },
    });

    expect(outcome).toBe(moved);
    expect(reads).toBe(0);
  });

  it("opens where the test is when another device moved it past the question", async () => {
    await expect(
      answerOrRead({ answer: async () => FAILED, question: QUESTION, read: async () => moved }),
    ).resolves.toBe(moved);
  });

  it("says the answer didn't save while the test still asks the question, or can't be read", async () => {
    const still = ready({ attempt: ATTEMPT, next: QUESTION });

    await expect(
      answerOrRead({ answer: async () => FAILED, question: QUESTION, read: async () => still }),
    ).resolves.toBeNull();

    await expect(
      answerOrRead({
        answer: () => Promise.reject(new Error("offline")),
        question: QUESTION,
        read: () => Promise.reject(new Error("offline")),
      }),
    ).resolves.toBeNull();
  });
});
