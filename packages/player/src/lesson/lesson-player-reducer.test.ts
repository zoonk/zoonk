import { describe, expect, it } from "vitest";
import {
  checkStep,
  explanationStep,
  fillBlankStep,
  hookGuessStep,
  stepResult,
  summaryStep,
  typedAnswerStep,
  workedExampleStep,
} from "./_test-utils/lesson-steps";
import { getLessonHyperdriveLevel, getLessonTopHyperdrive } from "./_utils/lesson-hyperdrive";
import { lessonPlayerReducer } from "./lesson-player-reducer";
import {
  type LessonPlayerAction,
  type LessonPlayerState,
  createInitialState,
  getCurrentStep,
} from "./lesson-player-state";
import { type PlayableLibraryStep } from "./lesson-player-types";

const NO_HYPERDRIVE = { knownStepIds: [], streak: 0 };

function play(steps: PlayableLibraryStep[], actions: LessonPlayerAction[]): LessonPlayerState {
  return actions.reduce(
    (state, action) => lessonPlayerReducer(state, action),
    createInitialState({ id: "lesson", steps }),
  );
}

function answerCheck(stepId: string, isCorrect: boolean): LessonPlayerAction[] {
  return [
    {
      answer: { kind: "check", optionId: isCorrect ? "right" : "wrong" },
      stepId,
      type: "selectAnswer",
    },
    { counts: true, result: stepResult(isCorrect), stepId, type: "checkResolved" },
  ];
}

describe(lessonPlayerReducer, () => {
  it("moves through reading screens and back, but never back into a question", () => {
    const steps = [checkStep("quiz"), explanationStep("a"), explanationStep("b")];

    const atB = play(steps, [
      ...answerCheck("quiz", true),
      { type: "continue" },
      { type: "continue" },
    ]);

    expect(getCurrentStep(atB)?.id).toBe("b");

    const backToA = lessonPlayerReducer(atB, { direction: "prev", type: "navigate" });
    expect(getCurrentStep(backToA)?.id).toBe("a");

    const stillA = lessonPlayerReducer(backToA, { direction: "prev", type: "navigate" });
    expect(getCurrentStep(stillA)?.id).toBe("a");
  });

  it("skips the rest of a skipped activity's screens and goes on from where the learner is", () => {
    const steps = [
      typedAnswerStep("write-1"),
      explanationStep("tip"),
      typedAnswerStep("write-2"),
      summaryStep("end"),
    ];

    const skipped = play(steps, [{ kinds: ["typedAnswer"], type: "skipKinds" }]);

    expect(skipped.queue).toStrictEqual(["tip", "end"]);
    expect(getCurrentStep(skipped)?.id).toBe("tip");
  });

  it("finishes a lesson whose only screens left were skipped", () => {
    const steps = [explanationStep("tip"), typedAnswerStep("write")];

    const done = play(steps, [{ type: "continue" }, { kinds: ["typedAnswer"], type: "skipKinds" }]);

    expect(done.phase).toBe("completed");
  });

  it("reveals a worked example one step at a time before moving on", () => {
    const steps = [workedExampleStep("worked"), summaryStep("summary")];

    const shown = [1, 2, 3].map(
      (count) =>
        play(
          steps,
          Array.from({ length: count - 1 }, () => ({ type: "continue" }) as const),
        ).revealed.worked ?? 1,
    );

    expect(shown).toStrictEqual([1, 2, 3]);

    const moved = play(steps, [{ type: "continue" }, { type: "continue" }, { type: "continue" }]);
    expect(getCurrentStep(moved)?.id).toBe("summary");
  });

  it("shows feedback after a check and counts only the first verdict", () => {
    const state = play([checkStep("quiz"), summaryStep("s")], answerCheck("quiz", true));

    expect(state.phase).toBe("feedback");
    expect(state.firstVerdicts).toStrictEqual({ quiz: true });

    const next = lessonPlayerReducer(state, { type: "continue" });
    expect([next.phase, getCurrentStep(next)?.id]).toStrictEqual(["playing", "s"]);
  });

  it("sends a missed check to the end of the lesson once, fresh", () => {
    const steps = [checkStep("quiz"), explanationStep("e")];

    const missed = play(steps, [
      ...answerCheck("quiz", false),
      { type: "continue" },
      { type: "continue" },
    ]);

    expect(missed.queue).toStrictEqual(["quiz", "e", "quiz"]);

    expect([getCurrentStep(missed)?.id, missed.answers.quiz, missed.results.quiz]).toStrictEqual([
      "quiz",
      undefined,
      undefined,
    ]);

    const missedAgain = play(steps, [
      ...answerCheck("quiz", false),
      { type: "continue" },
      { type: "continue" },
      ...answerCheck("quiz", false),
    ]);

    expect(missedAgain.queue).toStrictEqual(["quiz", "e", "quiz"]);
    expect(missedAgain.firstVerdicts).toStrictEqual({ quiz: false });

    expect(lessonPlayerReducer(missedAgain, { type: "continue" })).toMatchObject({
      completion: { status: "saving", testedOut: false },
      phase: "completed",
    });
  });

  it("lets a language answer self-correct once before the answer shows, counting the first try", () => {
    const wrong: LessonPlayerAction = {
      counts: true,
      result: stepResult(false),
      stepId: "order",
      type: "checkResolved",
    };

    const firstTry = play([fillBlankStep("order"), summaryStep("end")], [wrong]);

    expect(firstTry).toMatchObject({ notice: "selfCorrect", phase: "playing", results: {} });

    const secondTry = lessonPlayerReducer(firstTry, wrong);

    expect(secondTry).toMatchObject({ notice: null, phase: "feedback" });
    expect(secondTry.results.order?.correctAnswer).toBe("Right");
    expect(secondTry.firstVerdicts).toStrictEqual({ order: false });
  });

  it("shows a missed check's answer at once outside language practice", () => {
    const state = play([checkStep("quiz"), summaryStep("s")], answerCheck("quiz", false));

    expect(state).toMatchObject({ notice: null, phase: "feedback" });
    expect(state.results.quiz?.isCorrect).toBe(false);
  });

  it("reveals a hook's guess without counting it", () => {
    const state = play(
      [hookGuessStep("hook"), explanationStep("e")],
      [
        { answer: { kind: "hook", optionId: "yes" }, stepId: "hook", type: "selectAnswer" },
        { counts: false, result: stepResult(false), stepId: "hook", type: "checkResolved" },
      ],
    );

    expect([state.phase, state.firstVerdicts, state.queue]).toStrictEqual([
      "feedback",
      {},
      ["hook", "e"],
    ]);
  });

  it("waits for the server on a typed answer and lets the learner retry when it fails", () => {
    const steps = [typedAnswerStep("typed")];

    const typed = {
      answer: { kind: "typedAnswer", text: "A map" },
      stepId: "typed",
      type: "selectAnswer",
    } as const;

    const checking = play(steps, [typed, { stepId: "typed", type: "checkStarted" }]);
    expect(checking.phase).toBe("checking");

    const failed = lessonPlayerReducer(checking, { stepId: "typed", type: "checkFailed" });

    expect([failed.phase, failed.checkFailed, failed.answers.typed]).toStrictEqual([
      "playing",
      true,
      typed.answer,
    ]);

    const graded = lessonPlayerReducer(
      lessonPlayerReducer(failed, { stepId: "typed", type: "checkStarted" }),
      { counts: true, result: stepResult(true), stepId: "typed", type: "checkResolved" },
    );

    expect([graded.phase, graded.checkFailed]).toStrictEqual(["feedback", false]);
  });

  it.each([{ status: "limitReached", tier: "guest" } as const, { status: "noSpeech" } as const])(
    "says why an answer wasn't graded (%o), until the next try",
    (issue) => {
      const refused = play(
        [typedAnswerStep("spoken")],
        [
          { stepId: "spoken", type: "checkStarted" },
          { issue, stepId: "spoken", type: "checkFailed" },
        ],
      );

      expect([refused.phase, refused.checkFailed, refused.checkIssue]).toStrictEqual([
        "playing",
        true,
        issue,
      ]);

      const retried = lessonPlayerReducer(refused, { stepId: "spoken", type: "checkStarted" });
      const failed = lessonPlayerReducer(retried, { stepId: "spoken", type: "checkFailed" });

      expect([retried.checkIssue, failed.checkIssue]).toStrictEqual([null, null]);
    },
  );

  it('brings the explanation in front of a question with "Explain first" and marks it helped', () => {
    const steps = [
      checkStep("quiz"),
      explanationStep("e1"),
      workedExampleStep("w"),
      checkStep("quiz2"),
    ];

    const state = play(steps, [{ type: "explainFirst" }]);

    expect(state.queue).toStrictEqual(["e1", "w", "quiz", "quiz2"]);
    expect([getCurrentStep(state)?.id, state.helped]).toStrictEqual(["e1", ["quiz"]]);

    const noExplanation = play([checkStep("quiz"), checkStep("quiz2")], [{ type: "explainFirst" }]);
    expect(noExplanation.queue).toStrictEqual(["quiz", "quiz2"]);
  });

  it('ends the lesson when "I know this" gets every check right', () => {
    const steps = [
      explanationStep("e"),
      checkStep("q1"),
      explanationStep("e2"),
      checkStep("quiz2"),
    ];

    const state = play(steps, [
      { type: "knowThis" },
      ...answerCheck("q1", true),
      { type: "continue" },
      ...answerCheck("quiz2", true),
      { type: "continue" },
    ]);

    expect(state).toMatchObject({
      completion: { status: "saving", testedOut: true },
      firstVerdicts: { q1: true, quiz2: true },
      phase: "completed",
    });
  });

  it('returns to the lesson when "I know this" misses a check, keeping what was right', () => {
    const steps = [
      explanationStep("e"),
      checkStep("q1"),
      explanationStep("e2"),
      checkStep("quiz2"),
    ];

    const state = play(steps, [
      { type: "knowThis" },
      ...answerCheck("q1", true),
      { type: "continue" },
      ...answerCheck("quiz2", false),
      { type: "continue" },
    ]);

    expect(state).toMatchObject({
      notice: "quickCheckMissed",
      phase: "playing",
      queue: ["e", "e2", "quiz2"],
      quickCheck: null,
    });

    expect(getCurrentStep(state)?.id).toBe("e");
    expect(state.firstVerdicts).toStrictEqual({ q1: true, quiz2: false });
  });

  it("keeps answers still while a screen is being graded or after the end", () => {
    const checking = play([typedAnswerStep("typed")], [{ stepId: "typed", type: "checkStarted" }]);

    const ignored = lessonPlayerReducer(checking, {
      answer: { kind: "typedAnswer", text: "late" },
      stepId: "typed",
      type: "selectAnswer",
    });

    expect(ignored.answers).toStrictEqual({});
  });

  it("adds the server's review date to a verdict given on the device", () => {
    const state = play([checkStep("quiz")], answerCheck("quiz", true));

    const confirmed = lessonPlayerReducer(state, {
      result: {
        ...stepResult(true),
        nextReviewAt: "2026-10-02T00:00:00.000Z",
        savedMistake: false,
      },
      stepId: "quiz",
      type: "checkConfirmed",
    });

    expect(confirmed.results.quiz?.nextReviewAt).toBe("2026-10-02T00:00:00.000Z");
  });

  it("tracks the run and the completion as the server answers", () => {
    const done = play(
      [explanationStep("e")],
      [
        { type: "runStarting" },
        { hyperdrive: NO_HYPERDRIVE, runId: "run-1", type: "runStarted" },
        { type: "continue" },
        { type: "completionFailed" },
        { type: "completionRetried" },
      ],
    );

    expect([done.run, done.completion?.status]).toStrictEqual([
      { hyperdrive: NO_HYPERDRIVE, runId: "run-1", status: "started" },
      "saving",
    ]);

    const restarted = lessonPlayerReducer(done, { type: "restart" });

    expect([restarted.phase, restarted.run, restarted.position]).toStrictEqual([
      "playing",
      { status: "idle" },
      0,
    ]);
  });
});

describe(getLessonHyperdriveLevel, () => {
  const steps = [checkStep("one"), checkStep("two"), checkStep("three")];

  it("builds on right answers in a row and resets on a wrong one", () => {
    const twoRight = play(steps, [
      ...answerCheck("one", true),
      { type: "continue" },
      ...answerCheck("two", true),
    ]);

    expect(getLessonHyperdriveLevel(twoRight)).toBe(2);

    const thenWrong = play(steps, [
      ...answerCheck("one", true),
      { type: "continue" },
      ...answerCheck("two", true),
      { type: "continue" },
      ...answerCheck("three", false),
    ]);

    expect([getLessonHyperdriveLevel(thenWrong), getLessonTopHyperdrive(thenWrong)]).toStrictEqual([
      0, 2,
    ]);
  });

  it("continues the session's streak, keeps it on repeats and caps at x5", () => {
    const state = play(steps, [
      { hyperdrive: { knownStepIds: ["two"], streak: 4 }, runId: "run", type: "runStarted" },
      ...answerCheck("one", true),
      { type: "continue" },
      ...answerCheck("two", true),
    ]);

    expect(getLessonHyperdriveLevel(state)).toBe(5);

    const repeatOnly = play(steps, [
      { hyperdrive: { knownStepIds: ["one"], streak: 1 }, runId: "run", type: "runStarted" },
      ...answerCheck("one", true),
    ]);

    expect(getLessonHyperdriveLevel(repeatOnly)).toBe(1);
  });

  it("counts answers given before the run started from the session's streak", () => {
    const state = play(steps, [
      ...answerCheck("one", true),
      { hyperdrive: { knownStepIds: [], streak: 2 }, runId: "run", type: "runStarted" },
    ]);

    expect(getLessonHyperdriveLevel(state)).toBe(3);
  });
});
