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
import { lessonPlayerReducer } from "./lesson-player-reducer";
import { getLessonScreen } from "./lesson-player-screen";
import {
  type LessonPlayerAction,
  type LessonPlayerState,
  createInitialState,
  getCurrentStep,
} from "./lesson-player-state";
import { type PlayableLibraryStep } from "./lesson-player-types";

/** This sitting started now; answers in these tests were given in it. */
const STARTED_AT = "2026-10-05T10:00:00.000Z";
const ANSWERED_AT = "2026-10-05T10:01:00.000Z";

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
  it("goes back one screen at a time, showing an answered question's result again", () => {
    const steps = [checkStep("quiz"), explanationStep("a"), explanationStep("b")];

    const atB = play(steps, [
      ...answerCheck("quiz", true),
      { type: "continue" },
      { type: "continue" },
    ]);

    expect(getCurrentStep(atB)?.id).toBe("b");

    const backToA = lessonPlayerReducer(atB, { direction: "prev", type: "navigate" });
    expect([getCurrentStep(backToA)?.id, backToA.phase]).toStrictEqual(["a", "playing"]);

    const backToQuiz = lessonPlayerReducer(backToA, { direction: "prev", type: "navigate" });

    expect(backToQuiz).toMatchObject({ phase: "feedback", position: 0, reviewing: true });
    expect(backToQuiz.results.quiz?.isCorrect).toBe(true);

    // The result in view stays put: Previous waits for the next screen.
    const stillQuiz = lessonPlayerReducer(backToQuiz, { direction: "prev", type: "navigate" });
    expect(stillQuiz.position).toBe(0);

    const forward = lessonPlayerReducer(stillQuiz, { type: "continue" });
    expect([getCurrentStep(forward)?.id, forward.reviewing]).toStrictEqual(["a", false]);
    expect(forward.firstVerdicts).toStrictEqual({ quiz: true });
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

  it('returns to the lesson when "I know this" misses a check, which comes back at the end', () => {
    const steps = [
      explanationStep("e"),
      checkStep("q1"),
      explanationStep("e2"),
      checkStep("quiz2"),
      explanationStep("e3"),
    ];

    const state = play(steps, [
      { type: "knowThis" },
      ...answerCheck("q1", true),
      { type: "continue" },
      ...answerCheck("quiz2", false),
      { type: "continue" },
    ]);

    expect(state).toMatchObject({
      notice: null,
      phase: "playing",
      queue: ["e", "e2", "e3", "quiz2"],
      quickCheck: null,
      retried: ["quiz2"],
    });

    expect(getCurrentStep(state)?.id).toBe("e");
    expect(state.firstVerdicts).toStrictEqual({ q1: true, quiz2: false });

    const retry = play(steps, [
      { type: "knowThis" },
      ...answerCheck("q1", true),
      { type: "continue" },
      ...answerCheck("quiz2", false),
      { type: "continue" },
      { type: "continue" },
      { type: "continue" },
      { type: "continue" },
    ]);

    // The retry is a plain, fresh question at the end: no quick check, no "Explain first".
    expect([getCurrentStep(retry)?.id, retry.quickCheck, retry.answers.quiz2]).toStrictEqual([
      "quiz2",
      null,
      undefined,
    ]);

    expect(getLessonScreen(retry).canExplainFirst).toBe(false);
  });

  it("opens a run the learner comes back to at the first screen still to answer", () => {
    const steps = [
      hookGuessStep("hook"),
      explanationStep("e1"),
      checkStep("q1"),
      explanationStep("e2"),
      checkStep("q2"),
      summaryStep("sum"),
    ];

    const resumed = play(steps, [
      {
        answers: [{ answeredAt: ANSWERED_AT, isCorrect: false, stepId: "q1" }],
        hyperdrive: { knownStepIds: [], streak: 0 },
        runId: "run",
        startedAt: STARTED_AT,
        type: "runStarted",
      },
    ]);

    expect(resumed).toMatchObject({
      firstVerdicts: { q1: false },
      phase: "playing",
      queue: ["hook", "e1", "q1", "e2", "q2", "sum", "q1"],
      retried: ["q1"],
      run: { runId: "run", status: "started" },
    });

    expect(getCurrentStep(resumed)?.id).toBe("e2");
  });

  it("finishes a resumed run with every screen answered, and leaves a lesson in play alone", () => {
    const steps = [explanationStep("e1"), checkStep("q1")];
    const answers = [{ answeredAt: ANSWERED_AT, isCorrect: true, stepId: "q1" }];
    const hyperdrive = { knownStepIds: [], streak: 0 };

    const done = play(steps, [
      { answers, hyperdrive, runId: "run", startedAt: STARTED_AT, type: "runStarted" },
    ]);

    expect(done).toMatchObject({ completion: { status: "saving" }, phase: "completed" });

    const answeredHere = play(steps, [
      { type: "continue" },
      ...answerCheck("q1", false),
      { answers, hyperdrive, runId: "run", startedAt: STARTED_AT, type: "runStarted" },
    ]);

    expect([answeredHere.phase, answeredHere.firstVerdicts]).toStrictEqual([
      "feedback",
      { q1: false },
    ]);
  });

  it("goes back to an answer the server never got instead of saving again and again", () => {
    const steps = [explanationStep("e1"), checkStep("q1"), explanationStep("e2"), checkStep("q2")];

    const finished = play(steps, [
      { type: "continue" },
      ...answerCheck("q1", true),
      { type: "continue" },
      { type: "continue" },
      ...answerCheck("q2", true),
      { type: "continue" },
    ]);

    expect(finished.phase).toBe("completed");

    const resynced = lessonPlayerReducer(finished, {
      answers: [{ answeredAt: ANSWERED_AT, isCorrect: true, stepId: "q1" }],
      type: "runResynced",
    });

    expect(resynced).toMatchObject({ notice: "answerNotSaved", phase: "playing" });
    expect(getCurrentStep(resynced)?.id).toBe("e2");

    const complete = lessonPlayerReducer(finished, {
      answers: [
        { answeredAt: ANSWERED_AT, isCorrect: true, stepId: "q1" },
        { answeredAt: ANSWERED_AT, isCorrect: true, stepId: "q2" },
      ],
      type: "runResynced",
    });

    expect([complete.phase, complete.completion?.status]).toStrictEqual(["completed", "failed"]);
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
    const hyperdrive = { knownStepIds: [], streak: 2 };

    const done = play(
      [explanationStep("e")],
      [
        { type: "runStarting" },
        { answers: [], hyperdrive, runId: "run-1", startedAt: STARTED_AT, type: "runStarted" },
        { type: "continue" },
        { type: "completionFailed" },
        { type: "completionRetried" },
      ],
    );

    expect([done.run, done.completion?.status]).toStrictEqual([
      { carriedStepIds: [], hyperdrive, runId: "run-1", status: "started" },
      "saving",
    ]);
  });
});
