import { describe, expect, it } from "vitest";
import {
  type PlacementAttemptView,
  type PlacementOutcome,
  type PlacementQuestion,
  type PlacementResult,
} from "../onboarding/onboarding-actions";
import { type PlacementPartOutcome } from "./placement-test-actions";
import { answerOrRead, toFinishedPhase, toPlacementTestPhase } from "./placement-test-phase";

const ATTEMPT_ID = "0198a6c4-2f6e-7c1a-9b1e-3f2d4c5b6a71";
const CHANGE_ID = "0198a6c4-2f6e-7c1a-9b1e-3f2d4c5b6a75";
const NEXT_LESSON = { id: "0198a6c4-2f6e-7c1a-9b1e-3f2d4c5b6a76", title: "Loops with for" };

const FULL: PlacementAttemptView = {
  answered: 4,
  chapter: "Variables and types",
  estimatedMinutes: 6,
  id: ATTEMPT_ID,
  length: "wholeCourse",
  nextPart: 4,
  part: 3,
  partComplete: false,
  parts: 14,
  partsLeft: 12,
  questions: 12,
  remainingEstimatedMinutes: 70,
  resume: null,
  totalEstimatedMinutes: 85,
};

const QUICK: PlacementAttemptView = { ...FULL, length: "quick", nextPart: 2, part: 1 };

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
  finishedAt: "2026-11-26T12:00:00.000Z",
  lessonsSkipped: 5,
  nextLesson: NEXT_LESSON,
  part: 1,
  partLessonsSkipped: 5,
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
  outcome: Partial<Extract<PlacementPartOutcome, { status: "finished" }>>,
): Extract<PlacementPartOutcome, { status: "finished" }> {
  return {
    attempt: null,
    changeId: CHANGE_ID,
    lessonsSkipped: 2,
    partLessonsSkipped: 2,
    result: null,
    status: "finished",
    ...outcome,
  };
}

describe(toPlacementTestPhase, () => {
  it("offers a test when none is open", () => {
    const outcome = ready({ next: QUESTION });

    for (const surface of ["plan", "onboarding"] as const) {
      expect(toPlacementTestPhase({ outcome, surface })).toStrictEqual({ kind: "offer" });
    }
  });

  it("offers the test again from the Plan after one ended, and shows onboarding the result of the test it ran", () => {
    const outcome = ready({ result: RESULT });

    expect(toPlacementTestPhase({ outcome, surface: "plan" })).toStrictEqual({ kind: "offer" });

    expect(toPlacementTestPhase({ outcome, surface: "onboarding" })).toStrictEqual({
      attempt: null,
      attemptId: ATTEMPT_ID,
      changeId: CHANGE_ID,
      heldUntilTomorrow: false,
      kind: "result",
      lessonsSkipped: 5,
      nextLesson: NEXT_LESSON,
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
    const outcome = ready({ attempt: FULL, next: QUESTION });

    expect(toPlacementTestPhase({ outcome, surface: "plan" })).toStrictEqual({
      attempt: FULL,
      failures: 0,
      kind: "question",
      question: QUESTION,
      trueFalseLabels: "trueFalse",
    });
  });

  it("waits while an open part's questions are being written", () => {
    const outcome: PlacementOutcome = { attempt: FULL, focusTest: null, status: "notReady" };

    expect(toPlacementTestPhase({ outcome, surface: "plan" })).toStrictEqual({ kind: "waiting" });
  });

  it("keeps the wait open for a retry when a part's questions couldn't be written", () => {
    const outcome: PlacementOutcome = { attempt: QUICK, status: "generationFailed" };

    expect(toPlacementTestPhase({ outcome, surface: "onboarding" })).toStrictEqual({
      failedAttempt: QUICK,
      kind: "waiting",
    });
  });

  it("says a started test has nothing to ask instead of offering it again", () => {
    const outcome: PlacementOutcome = { attempt: QUICK, status: "unavailable" };

    expect(toPlacementTestPhase({ outcome, surface: "plan" })).toStrictEqual({
      kind: "unavailable",
    });
  });

  it("closes a part that has nothing more to ask", () => {
    const outcome = ready({ attempt: FULL });

    expect(toPlacementTestPhase({ outcome, surface: "plan" })).toStrictEqual({
      attempt: FULL,
      kind: "partOver",
    });
  });

  it("says where a full test stands between parts and after a stop midway", () => {
    const between = { ...FULL, partComplete: true };
    const stopped = { ...FULL, resume: { part: 3, question: 5 } };

    for (const attempt of [between, stopped]) {
      const outcome = ready({ attempt, result: RESULT });

      expect(toPlacementTestPhase({ outcome, surface: "plan" })).toStrictEqual({
        attempt,
        kind: "continue",
      });
    }
  });

  it("shows a short test that ended as its result, with the rest of the course still to test", () => {
    const ended = { ...QUICK, partComplete: true };
    const outcome = ready({ attempt: ended, result: RESULT });

    expect(toPlacementTestPhase({ outcome, surface: "plan" })).toMatchObject({
      attempt: ended,
      kind: "result",
      lessonsSkipped: 5,
    });
  });

  it("says a read that failed couldn't open the test", () => {
    expect(toPlacementTestPhase({ outcome: { status: "failed" }, surface: "plan" })).toStrictEqual({
      kind: "loadFailed",
    });
  });
});

describe(toFinishedPhase, () => {
  it("stops a full test's finished part at its checkpoint, counting that part's skips", () => {
    const attempt = { ...FULL, partComplete: true };
    const phase = toFinishedPhase({ attemptId: ATTEMPT_ID, finished: finished({ attempt }) });

    expect(phase).toStrictEqual({
      attempt,
      changeId: CHANGE_ID,
      heldUntilTomorrow: false,
      kind: "checkpoint",
      lessonsSkipped: 2,
    });
  });

  it("says where a full test resumes when the learner stopped midway, never that the part is done", () => {
    const attempt = { ...FULL, resume: { part: 3, question: 5 } };
    const phase = toFinishedPhase({ attemptId: ATTEMPT_ID, finished: finished({ attempt }) });

    expect(phase).toMatchObject({ attempt, kind: "stopped", lessonsSkipped: 2 });
  });

  it("ends the short test at its result, stopped or not, while the course has parts left", () => {
    const complete = { ...QUICK, partComplete: true };
    const stopped = { ...QUICK, resume: { part: 1, question: 5 } };

    for (const attempt of [complete, stopped]) {
      const phase = toFinishedPhase({
        attemptId: ATTEMPT_ID,
        finished: finished({ attempt, lessonsSkipped: 5, result: RESULT }),
      });

      expect(phase).toStrictEqual({
        attempt,
        attemptId: ATTEMPT_ID,
        changeId: CHANGE_ID,
        heldUntilTomorrow: false,
        kind: "result",
        lessonsSkipped: 5,
        nextLesson: NEXT_LESSON,
      });
    }
  });

  it("counts the whole test on its last part's result, without an Undo that restores only that part", () => {
    const phase = toFinishedPhase({
      attemptId: ATTEMPT_ID,
      finished: finished({ result: { ...RESULT, lessonsSkipped: 9, part: 14 } }),
    });

    expect(phase).toMatchObject({
      attempt: null,
      changeId: null,
      kind: "result",
      lessonsSkipped: 9,
    });
  });

  it("offers no Undo on a part whose earlier stop already skipped some of what the screen counts", () => {
    const attempt = { ...FULL, partComplete: true };

    const phase = toFinishedPhase({
      attemptId: ATTEMPT_ID,
      finished: finished({ attempt, lessonsSkipped: 1, partLessonsSkipped: 3 }),
    });

    expect(phase).toMatchObject({ changeId: null, kind: "checkpoint", lessonsSkipped: 3 });
  });

  it("carries a skip held until tomorrow", () => {
    const phase = toFinishedPhase({
      attemptId: ATTEMPT_ID,
      finished: finished({
        heldUntilTomorrow: true,
        lessonsSkipped: 0,
        result: { ...RESULT, lessonsSkipped: 0 },
      }),
    });

    expect(phase).toMatchObject({ heldUntilTomorrow: true, kind: "result", lessonsSkipped: 0 });
  });
});

describe(answerOrRead, () => {
  const OTHER = { ...QUESTION, itemId: "0198a6c4-2f6e-7c1a-9b1e-3f2d4c5b6a77" };
  const FAILED: PlacementOutcome = { status: "failed" };
  const moved = ready({ attempt: { ...FULL, part: 4 }, next: OTHER });

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
    const still = ready({ attempt: FULL, next: QUESTION });

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
