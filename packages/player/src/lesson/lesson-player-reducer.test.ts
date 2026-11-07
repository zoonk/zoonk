import { describe, expect, it } from "vitest";
import {
  challengeStep,
  checkStep,
  explanationStep,
  fillBlankStep,
  hookGuessStep,
  numberAnswerStep,
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
import {
  type LessonPlayerAnswer,
  type LessonRunAnswers,
  type PlayableLibraryStep,
} from "./lesson-player-types";
import { toRunAnswer } from "./use-held-answers";

const STARTED_AT = "2026-10-05T10:00:00.000Z";
const ANSWERED_AT = "2026-10-05T10:01:00.000Z";
const LATER = "2026-10-05T10:02:00.000Z";
const HYPERDRIVE = { knownStepIds: [], streak: 0 };

const CLOUD_PICTURE = {
  alt: "A cloud",
  height: null,
  id: "cloud",
  url: "https://example.com/cloud.png",
  width: null,
};

function runAnswer(stepId: string, isCorrect: boolean, answeredAt = ANSWERED_AT) {
  const answer = { kind: "check", optionId: isCorrect ? "right" : "wrong" } as const;
  return { answer, answeredAt, isCorrect, result: stepResult(isCorrect), stepId };
}

function blankAnswer(
  word: string,
  isCorrect: boolean,
  answeredAt = ANSWERED_AT,
): LessonRunAnswers[number] {
  return {
    answer: { kind: "fillBlank", userAnswers: [word] },
    answeredAt,
    isCorrect,
    result: stepResult(isCorrect),
    stepId: "blank",
  };
}

function runStarted({
  answers,
  held,
}: Pick<Extract<LessonPlayerAction, { type: "runStarted" }>, "answers" | "held">) {
  return {
    answers,
    held,
    hyperdrive: HYPERDRIVE,
    replay: false,
    runId: "run",
    startedAt: STARTED_AT,
    type: "runStarted",
  } as const;
}

function playOn(state: LessonPlayerState, actions: LessonPlayerAction[]): LessonPlayerState {
  return actions.reduce((current, action) => lessonPlayerReducer(current, action), state);
}

function play(steps: PlayableLibraryStep[], actions: LessonPlayerAction[]): LessonPlayerState {
  return playOn(createInitialState({ hasMap: false, id: "lesson", steps }), actions);
}

function pickChallenge(choiceIds: string[]): LessonPlayerAction {
  return { answer: { choiceIds, kind: "challenge" }, stepId: "case", type: "selectAnswer" };
}

function answerCheck(
  stepId: string,
  isCorrect: boolean,
  attemptId = `${stepId}-attempt`,
): LessonPlayerAction[] {
  return [
    {
      answer: { kind: "check", optionId: isCorrect ? "right" : "wrong" },
      stepId,
      type: "selectAnswer",
    },
    {
      counts: true,
      result: { ...stepResult(isCorrect), attemptId },
      stepId,
      type: "checkResolved",
    },
  ];
}

describe(lessonPlayerReducer, () => {
  it("shows the sample answer of an open answer the learner doesn't know, without a verdict", () => {
    const steps = [typedAnswerStep("first"), explanationStep("tip"), typedAnswerStep("last")];
    const shown = play(steps, [{ stepId: "first", type: "skipWriting" }]);

    expect(shown).toMatchObject({ notice: null, phase: "feedback", position: 0 });
    expect(shown.queue).toStrictEqual(["first", "tip", "last"]);
    expect(shown.skippedWritingStepIds).toStrictEqual(["first"]);
    expect(shown.firstVerdicts).toStrictEqual({});

    expect(shown.results.first).toMatchObject({
      answerText: null,
      checked: false,
      correctAnswer: "Because it maps chances.",
      savedMistake: false,
    });

    const next = lessonPlayerReducer(shown, { type: "continue" });
    expect([getCurrentStep(next)?.id, next.queue]).toStrictEqual(["tip", ["first", "tip", "last"]]);
  });

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

    const stillQuiz = lessonPlayerReducer(backToQuiz, { direction: "prev", type: "navigate" });
    expect(stillQuiz.position).toBe(0);

    const forward = lessonPlayerReducer(stillQuiz, { type: "continue" });
    expect([getCurrentStep(forward)?.id, forward.reviewing]).toStrictEqual(["a", false]);
    expect(forward.firstVerdicts).toStrictEqual({ quiz: true });
  });

  it("keeps an unchecked answer when the learner goes back, and shows it again on Next", () => {
    const picked = { kind: "check", optionId: "right" } as const;

    const answered = play(
      [explanationStep("tip"), checkStep("quiz")],
      [{ type: "continue" }, { answer: picked, stepId: "quiz", type: "selectAnswer" }],
    );

    const back = lessonPlayerReducer(answered, { direction: "prev", type: "navigate" });
    expect([getCurrentStep(back)?.id, back.answers.quiz]).toStrictEqual(["tip", picked]);

    const again = lessonPlayerReducer(back, { type: "continue" });

    expect([getCurrentStep(again)?.id, again.answers.quiz]).toStrictEqual(["quiz", picked]);
    expect(again.rounds).toStrictEqual(answered.rounds);
    expect(getLessonScreen(again).primary).toMatchObject({ disabled: false, label: "check" });
  });

  it("starts a question over only when a checked attempt of it comes back", () => {
    const missed = play(
      [checkStep("quiz"), explanationStep("tip")],
      [...answerCheck("quiz", false), { type: "continue" }],
    );

    const retry = lessonPlayerReducer(missed, { type: "continue" });

    expect(getCurrentStep(retry)?.id).toBe("quiz");
    expect([retry.answers.quiz, retry.results.quiz]).toStrictEqual([undefined, undefined]);
    expect(retry.rounds.quiz).toBe((missed.rounds.quiz ?? 0) + 1);
  });

  it("stops Previous before the earlier copy of a question that came back", () => {
    const steps = [checkStep("quiz"), explanationStep("tip"), summaryStep("end")];

    const retry = play(steps, [
      ...answerCheck("quiz", false),
      { type: "continue" },
      { type: "continue" },
      { type: "continue" },
    ]);

    expect([getCurrentStep(retry)?.id, retry.position]).toStrictEqual(["quiz", 3]);

    const back: LessonPlayerAction = { direction: "prev", type: "navigate" };
    const atTip = lessonPlayerReducer(lessonPlayerReducer(retry, back), back);

    expect([getCurrentStep(atTip)?.id, getLessonScreen(atTip).canGoBack]).toStrictEqual([
      "tip",
      false,
    ]);

    expect(lessonPlayerReducer(atTip, back).position).toBe(1);
  });

  it("stops Previous on a missed last question that comes straight back", () => {
    const retry = play(
      [explanationStep("tip"), checkStep("quiz")],
      [{ type: "continue" }, ...answerCheck("quiz", false), { type: "continue" }],
    );

    expect([getCurrentStep(retry)?.id, retry.queue]).toStrictEqual([
      "quiz",
      ["tip", "quiz", "quiz"],
    ]);

    expect(getLessonScreen(retry).canGoBack).toBe(false);

    const stillThere = lessonPlayerReducer(retry, { direction: "prev", type: "navigate" });

    expect([stillThere.position, stillThere.answers.quiz]).toStrictEqual([2, undefined]);
  });

  it("brings a pending self-correction back with its notice after the learner goes back", () => {
    const wrong: LessonPlayerAction = {
      counts: true,
      result: stepResult(false),
      stepId: "order",
      type: "checkResolved",
    };

    const built: LessonPlayerAnswer = { kind: "fillBlank", userAnswers: ["Wrong"] };

    const firstTry = play(
      [explanationStep("tip"), fillBlankStep("order")],
      [{ type: "continue" }, { answer: built, stepId: "order", type: "selectAnswer" }, wrong],
    );

    expect(firstTry.notice).toBe("selfCorrect");

    const back = lessonPlayerReducer(firstTry, { direction: "prev", type: "navigate" });
    expect(back.notice).toBeNull();

    const again = lessonPlayerReducer(back, { type: "continue" });

    expect([again.notice, again.answers.order]).toStrictEqual(["selfCorrect", built]);
  });

  it("goes on with a challenge left halfway when the learner comes back to it", () => {
    const halfway = play(
      [explanationStep("tip"), challengeStep("case")],
      [
        { type: "continue" },
        { type: "continue" },
        pickChallenge(["ask"]),
        { type: "continue" },
        pickChallenge(["ask", "ship"]),
        { direction: "prev", type: "navigate" },
        { type: "continue" },
      ],
    );

    expect(getCurrentStep(halfway)?.id).toBe("case");
    expect(getLessonScreen(halfway).primary).toMatchObject({ disabled: false, label: "confirm" });
  });

  it("skips the rest of a skipped activity's screens and goes on from where the learner is", () => {
    const steps = [
      typedAnswerStep("write-1"),
      explanationStep("tip"),
      typedAnswerStep("write-2"),
      summaryStep("end"),
    ];

    const skipped = play(steps, [{ type: "skipWriting" }]);

    expect(skipped.queue).toStrictEqual(["tip", "end"]);
    expect(getCurrentStep(skipped)?.id).toBe("tip");
    expect(skipped.skippedWritingStepIds).toStrictEqual(["write-1", "write-2"]);
    expect(skipped.firstVerdicts).toStrictEqual({});

    expect(skipped.notice).toBe("writingSkipped");
    expect(lessonPlayerReducer(skipped, { type: "continue" }).notice).toBeNull();
  });

  it("keeps number questions when the rest of the writing is left out", () => {
    const steps = [typedAnswerStep("write"), numberAnswerStep("count"), summaryStep("end")];
    const skipped = play(steps, [{ type: "skipWriting" }]);

    expect(skipped.queue).toStrictEqual(["count", "end"]);
    expect(getCurrentStep(skipped)?.id).toBe("count");
    expect(skipped.skippedWritingStepIds).toStrictEqual(["write"]);
  });

  it("puts the writing back with Write again until the learner moves on", () => {
    const steps = [explanationStep("tip"), typedAnswerStep("write"), summaryStep("end")];
    const skipped = play(steps, [{ opening: true, type: "skipWriting" }]);

    expect(skipped).toMatchObject({ notice: "writingSkipped", position: 0, queue: ["tip", "end"] });

    const restored = lessonPlayerReducer(skipped, { type: "writingRestored" });

    expect(restored).toMatchObject({ notice: null, position: 0, queue: ["tip", "write", "end"] });
    expect(restored.skippedWritingStepIds).toStrictEqual([]);

    const movedOn = lessonPlayerReducer(skipped, { type: "continue" });
    expect(lessonPlayerReducer(movedOn, { type: "writingRestored" })).toBe(movedOn);
  });

  it("keeps today's writing notice and undo when run start reconciles stale progress", () => {
    const steps = [
      checkStep("quiz"),
      typedAnswerStep("write"),
      explanationStep("tip"),
      summaryStep("end"),
    ];

    const resumed = play(steps, [
      { opening: true, type: "skipWriting" },
      {
        answers: [runAnswer("quiz", true)],
        held: [],
        hyperdrive: { knownStepIds: [], streak: 0 },
        replay: false,
        runId: "run",
        startedAt: STARTED_AT,
        type: "runStarted",
      },
    ]);

    expect(resumed.notice).toBe("writingSkipped");
    expect(getCurrentStep(resumed)?.id).toBe("tip");
    expect(resumed.skippedWritingStepIds).toStrictEqual(["write"]);

    const restored = lessonPlayerReducer(resumed, { type: "writingRestored" });
    expect(getCurrentStep(restored)?.id).toBe("write");
    expect(restored.queue).toStrictEqual(["quiz", "write", "tip", "end"]);
    expect(restored.skippedWritingStepIds).toStrictEqual([]);
    expect(restored.firstVerdicts).toStrictEqual({ quiz: true });
    expect(restored.run).toMatchObject({ runId: "run", status: "started" });
  });

  it("brings the learner back to the screen they left with Can't write now", () => {
    const steps = [typedAnswerStep("write"), explanationStep("tip")];
    const skipped = play(steps, [{ type: "skipWriting" }]);
    const restored = lessonPlayerReducer(skipped, { type: "writingRestored" });

    expect([getCurrentStep(restored)?.id, restored.phase]).toStrictEqual(["write", "playing"]);
  });

  it("waits for Finish when writing left out as the lesson opens leaves nothing to do", () => {
    const opened = play([typedAnswerStep("write")], [{ opening: true, type: "skipWriting" }]);
    expect(opened).toMatchObject({ completion: { status: "ready" }, phase: "completed" });
  });

  it("leaves out screens that can't be played, the one in view too, and keeps the ones before", () => {
    const steps = [
      explanationStep("tip"),
      typedAnswerStep("numbered"),
      explanationStep("next"),
      summaryStep("end"),
    ];

    const atNumbered = play(steps, [{ type: "continue" }]);
    const left = lessonPlayerReducer(atNumbered, { stepIds: ["numbered"], type: "skipSteps" });

    expect(left.queue).toStrictEqual(["tip", "next", "end"]);
    expect(getCurrentStep(left)?.id).toBe("next");
  });

  it("finishes a lesson whose only screens left were skipped", () => {
    const steps = [explanationStep("tip"), typedAnswerStep("write")];

    const done = play(steps, [{ type: "continue" }, { type: "skipWriting" }]);

    expect(done).toMatchObject({ completion: { status: "saving" }, phase: "completed" });
  });

  it("keeps writing skipped when a missing non-writing answer resyncs the same lesson", () => {
    const steps = [checkStep("quiz"), typedAnswerStep("write"), summaryStep("end")];

    const done = play(steps, [
      ...answerCheck("quiz", true),
      { type: "continue" },
      { type: "skipWriting" },
      { type: "continue" },
    ]);

    const resumed = lessonPlayerReducer(done, { answers: [], type: "runResynced" });
    expect(getCurrentStep(resumed)?.id).toBe("quiz");
    expect(resumed.queue).toStrictEqual(["quiz", "end"]);
    expect(resumed.skippedWritingStepIds).toStrictEqual(["write"]);
  });

  it("waits for Finish when the last screen disappears without a learner action", () => {
    const done = play(
      [typedAnswerStep("numbered")],
      [{ stepIds: ["numbered"], type: "skipSteps" }],
    );

    expect(done).toMatchObject({ completion: { status: "ready" }, phase: "completed" });

    expect(lessonPlayerReducer(done, { type: "completionRetried" })).toMatchObject({
      completion: { status: "saving" },
    });
  });

  it("opens an empty lesson ready to finish, without saving on entry", () => {
    expect(createInitialState({ hasMap: false, id: "empty", steps: [] })).toMatchObject({
      completion: { status: "ready" },
      phase: "completed",
    });
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
        answers: [runAnswer("q1", false)],
        held: [],
        hyperdrive: { knownStepIds: [], streak: 0 },
        replay: false,
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

  it("waits for a deliberate finish on a resumed run with every screen answered", () => {
    const steps = [explanationStep("e1"), checkStep("q1")];
    const answers = [runAnswer("q1", true)];
    const hyperdrive = { knownStepIds: [], streak: 0 };

    const done = play(steps, [
      {
        answers,
        held: [],
        hyperdrive,
        replay: false,
        runId: "run",
        startedAt: STARTED_AT,
        type: "runStarted",
      },
    ]);

    expect(done).toMatchObject({ completion: { status: "ready" }, phase: "completed" });

    expect(lessonPlayerReducer(done, { type: "completionRetried" })).toMatchObject({
      completion: { status: "saving" },
      phase: "completed",
    });

    const answeredHere = play(steps, [
      { type: "continue" },
      ...answerCheck("q1", false),
      {
        answers,
        held: [],
        hyperdrive,
        replay: false,
        runId: "run",
        startedAt: STARTED_AT,
        type: "runStarted",
      },
    ]);

    expect([answeredHere.phase, answeredHere.results.q1?.isCorrect]).toStrictEqual([
      "feedback",
      false,
    ]);

    expect(answeredHere.firstVerdicts).toStrictEqual({ q1: true });
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
      answers: [runAnswer("q1", true)],
      type: "runResynced",
    });

    expect(resynced).toMatchObject({ notice: "answerNotSaved", phase: "playing" });
    expect(getCurrentStep(resynced)?.id).toBe("q2");

    const complete = lessonPlayerReducer(finished, {
      answers: [runAnswer("q1", true), runAnswer("q2", true)],
      type: "runResynced",
    });

    expect([complete.phase, complete.completion?.status]).toStrictEqual(["completed", "failed"]);
  });

  it("lands on each screen the run still needs, with its own line, and skips what it has", () => {
    const steps = [
      explanationStep("e1"),
      checkStep("q1"),
      explanationStep("e2"),
      checkStep("pictured"),
      explanationStep("e3"),
      checkStep("q3"),
      summaryStep("sum"),
    ];

    const finished = play(steps, [
      { type: "continue" },
      ...answerCheck("q1", true),
      { type: "continue" },
      { stepIds: ["pictured"], type: "skipSteps" },
      { type: "continue" },
      { type: "continue" },
      ...answerCheck("q3", true),
      { type: "continue" },
      { type: "continue" },
    ]);

    expect(finished.phase).toBe("completed");

    const recovered = lessonPlayerReducer(finished, {
      answers: [runAnswer("q3", true)],
      pictures: [{ image: CLOUD_PICTURE, stepId: "pictured" }],
      type: "runResynced",
    });

    expect(recovered).toMatchObject({ notice: "answerNotSaved", phase: "playing" });
    expect(recovered.queue).toStrictEqual(["e1", "q1", "e2", "pictured", "e3", "q3", "sum"]);
    expect(getCurrentStep(recovered)?.id).toBe("q1");

    const back = lessonPlayerReducer(recovered, { direction: "prev", type: "navigate" });
    expect([getCurrentStep(back)?.id, back.notice]).toStrictEqual(["e1", null]);

    const again = lessonPlayerReducer(back, { type: "continue" });
    expect([getCurrentStep(again)?.id, again.notice]).toStrictEqual(["q1", "answerNotSaved"]);

    const answered = playOn(again, [...answerCheck("q1", false), { type: "continue" }]);

    expect([getCurrentStep(answered)?.id, answered.notice]).toStrictEqual([
      "pictured",
      "pictureReady",
    ]);

    const stillMissing = playOn(answered, [
      { answer: { kind: "check", optionId: "right" }, stepId: "pictured", type: "selectAnswer" },
      { stepId: "pictured", type: "checkStarted" },
      { stepId: "pictured", type: "checkFailed" },
    ]);

    expect(stillMissing.notice).toBe("pictureReady");

    const retry = playOn(stillMissing, [...answerCheck("pictured", true), { type: "continue" }]);

    expect([
      getCurrentStep(retry)?.id,
      retry.position,
      retry.notice,
      retry.results.q1,
    ]).toStrictEqual(["q1", 7, null, undefined]);

    const done = playOn(retry, [...answerCheck("q1", true), { type: "continue" }]);

    expect(done).toMatchObject({ completion: { status: "saving" }, phase: "completed" });
  });

  it('asks every question of "I know this" while a finished lesson comes back to a screen it still needs, and brings back what it missed', () => {
    const steps = [
      explanationStep("e1"),
      checkStep("q1"),
      explanationStep("e2"),
      checkStep("q2"),
      summaryStep("sum"),
    ];

    const finished = play(steps, [
      { type: "continue" },
      ...answerCheck("q1", true),
      { type: "continue" },
      { type: "continue" },
      ...answerCheck("q2", false),
      { type: "continue" },
      { type: "continue" },
      ...answerCheck("q2", true),
      { type: "continue" },
    ]);

    expect(finished.phase).toBe("completed");

    const recovered = lessonPlayerReducer(finished, {
      answers: [runAnswer("q2", false)],
      type: "runResynced",
    });

    expect(getCurrentStep(recovered)?.id).toBe("q1");

    const quickCheck = playOn(recovered, [
      { direction: "prev", type: "navigate" },
      { type: "knowThis" },
    ]);

    const second = playOn(quickCheck, [...answerCheck("q1", true), { type: "continue" }]);

    expect([getCurrentStep(second)?.id, second.phase]).toStrictEqual(["q2", "playing"]);
    expect(second.quickCheck).not.toBeNull();

    const secondAgain = playOn(second, [
      ...answerCheck("q2", false),
      { type: "continue" },
      { type: "continue" },
    ]);

    expect([getCurrentStep(secondAgain)?.id, secondAgain.phase]).toStrictEqual(["q2", "playing"]);

    const missedFirst = playOn(quickCheck, [...answerCheck("q1", false), { type: "continue" }]);

    expect([missedFirst.queue, missedFirst.results.q2?.isCorrect]).toStrictEqual([
      ["e1", "e2", "q2", "sum", "q2", "q1"],
      false,
    ]);

    const retry = lessonPlayerReducer(missedFirst, { type: "continue" });

    expect([getCurrentStep(retry)?.id, retry.position, retry.phase]).toStrictEqual([
      "q2",
      4,
      "playing",
    ]);

    const firstAgain = playOn(retry, [...answerCheck("q2", true), { type: "continue" }]);

    expect([getCurrentStep(firstAgain)?.id, firstAgain.phase, firstAgain.notice]).toStrictEqual([
      "q1",
      "playing",
      null,
    ]);
  });

  it("lands on the first question when no answer reached the server", () => {
    const steps = [explanationStep("e1"), checkStep("q1"), explanationStep("e2"), checkStep("q2")];

    const finished = play(steps, [
      { type: "continue" },
      ...answerCheck("q1", true),
      { type: "continue" },
      { type: "continue" },
      ...answerCheck("q2", true),
      { type: "continue" },
    ]);

    const recovered = lessonPlayerReducer(finished, { answers: [], type: "runResynced" });

    expect([getCurrentStep(recovered)?.id, recovered.notice]).toStrictEqual([
      "q1",
      "answerNotSaved",
    ]);
  });

  it("keeps the opening guess when a finished lesson comes back to a screen it still needs", () => {
    const steps = [hookGuessStep("hook"), checkStep("q1"), checkStep("q2")];
    const guess = { kind: "hook", optionId: "no" } as const;

    const finished = play(steps, [
      { answer: guess, stepId: "hook", type: "selectAnswer" },
      { counts: false, result: stepResult(true), stepId: "hook", type: "checkResolved" },
      { type: "continue" },
      ...answerCheck("q1", true),
      { type: "continue" },
      ...answerCheck("q2", true),
      { type: "continue" },
    ]);

    const recovered = lessonPlayerReducer(finished, {
      answers: [runAnswer("q1", true)],
      type: "runResynced",
    });

    expect([getCurrentStep(recovered)?.id, recovered.answers.hook]).toStrictEqual(["q2", guess]);
    expect(recovered.results.hook?.isCorrect).toBe(true);
  });

  it("shows a question answered before the learner left as answered when they go back to it", () => {
    const steps = [explanationStep("e1"), checkStep("q1"), explanationStep("e2"), checkStep("q2")];
    const resumed = play(steps, [runStarted({ answers: [runAnswer("q1", true)], held: [] })]);

    expect(getCurrentStep(resumed)?.id).toBe("e2");

    const back = lessonPlayerReducer(resumed, { direction: "prev", type: "navigate" });

    expect(back).toMatchObject({ phase: "feedback", position: 1, reviewing: true });

    expect([back.answers.q1, back.results.q1?.isCorrect]).toStrictEqual([
      { kind: "check", optionId: "right" },
      true,
    ]);

    expect(getLessonScreen(back).primary).toMatchObject({ label: "continue" });

    const forward = lessonPlayerReducer(back, { type: "continue" });

    expect([getCurrentStep(forward)?.id, forward.firstVerdicts]).toStrictEqual([
      "e2",
      { q1: true },
    ]);
  });

  it("shows screens answered after the place a lesson reopens as answered on the way forward", () => {
    const steps = [
      explanationStep("e1"),
      checkStep("q1"),
      explanationStep("e2"),
      typedAnswerStep("typed"),
      challengeStep("case"),
    ];

    const typed: LessonRunAnswers[number] = {
      answer: { kind: "typedAnswer", text: "A map of chances" },
      answeredAt: ANSWERED_AT,
      isCorrect: true,
      result: { ...stepResult(true), answerText: "A map of chances" },
      stepId: "typed",
    };

    const challenge: LessonRunAnswers[number] = {
      answer: { choiceIds: ["ask", "ship"], kind: "challenge" },
      answeredAt: ANSWERED_AT,
      isCorrect: true,
      result: stepResult(true),
      stepId: "case",
    };

    const resumed = play(steps, [runStarted({ answers: [typed, challenge], held: [] })]);

    expect(getCurrentStep(resumed)?.id).toBe("e1");

    const atTyped = playOn(resumed, [
      { type: "continue" },
      ...answerCheck("q1", true),
      { type: "continue" },
      { type: "continue" },
    ]);

    expect(atTyped).toMatchObject({ phase: "feedback", reviewing: true });

    expect([getCurrentStep(atTyped)?.id, atTyped.answers.typed]).toStrictEqual([
      "typed",
      typed.answer,
    ]);

    const atCase = lessonPlayerReducer(atTyped, { type: "continue" });

    expect(atCase).toMatchObject({ phase: "feedback", revealed: { case: 3 }, reviewing: true });
    expect(getLessonScreen(atCase).primary).toMatchObject({ label: "continue" });
    expect(lessonPlayerReducer(atCase, { type: "continue" }).phase).toBe("completed");
  });

  it("still asks a resumed miss again where it comes back and in a quick check", () => {
    const steps = [
      explanationStep("e1"),
      checkStep("q1"),
      explanationStep("e2"),
      checkStep("q2"),
      summaryStep("sum"),
    ];

    const resumed = play(steps, [runStarted({ answers: [runAnswer("q1", false)], held: [] })]);

    expect([getCurrentStep(resumed)?.id, resumed.queue]).toStrictEqual([
      "e2",
      ["e1", "q1", "e2", "q2", "sum", "q1"],
    ]);

    const quickCheck = lessonPlayerReducer(resumed, { type: "knowThis" });

    expect([getCurrentStep(quickCheck)?.id, quickCheck.phase, quickCheck.results.q1]).toStrictEqual(
      ["q1", "playing", undefined],
    );

    const retry = playOn(resumed, [
      { type: "continue" },
      ...answerCheck("q2", true),
      { type: "continue" },
      { type: "continue" },
    ]);

    expect([retry.position, retry.phase, retry.answers.q1, retry.results.q1]).toStrictEqual([
      5,
      "playing",
      undefined,
      undefined,
    ]);
  });

  it("goes back from the map of a resumed lesson to its last question, answered", () => {
    const steps = [explanationStep("e1"), checkStep("q1")];

    const finished = lessonPlayerReducer(
      createInitialState({ hasMap: true, id: "lesson", steps }),
      runStarted({ answers: [runAnswer("q1", false), runAnswer("q1", true)], held: [] }),
    );

    expect([finished.phase, getLessonScreen(finished).canGoBack]).toStrictEqual(["map", true]);

    const back = lessonPlayerReducer(finished, { direction: "prev", type: "navigate" });

    expect(back).toMatchObject({ phase: "feedback", position: 1, reviewing: true });
    expect(back.results.q1?.isCorrect).toBe(true);
  });

  it("replaces the page's answers with fresher ones from the run, but not what the learner did", () => {
    const steps = [explanationStep("e1"), checkStep("q1"), explanationStep("e2"), checkStep("q2")];
    const miss = runAnswer("q1", false);
    const page = play(steps, [{ answers: [miss], type: "unsentPlaced" }]);

    expect([page.actedOn, page.queue]).toStrictEqual([[], ["e1", "q1", "e2", "q2", "q1"]]);

    const retried = lessonPlayerReducer(
      page,
      runStarted({ answers: [miss, runAnswer("q1", true)], held: [] }),
    );

    expect([
      getCurrentStep(retried)?.id,
      retried.queue,
      retried.results.q1?.isCorrect,
    ]).toStrictEqual(["e2", ["e1", "q1", "e2", "q2"], true]);

    const fresher = lessonPlayerReducer(
      page,
      runStarted({ answers: [miss, runAnswer("q2", true)], held: [] }),
    );

    expect([fresher.phase, fresher.results.q2?.isCorrect]).toStrictEqual(["playing", true]);

    const draft = { kind: "check", optionId: "right" } as const;

    const drafted = playOn(page, [
      { type: "continue" },
      { answer: draft, stepId: "q2", type: "selectAnswer" },
    ]);

    const kept = lessonPlayerReducer(
      drafted,
      runStarted({ answers: [miss, runAnswer("q2", false)], held: [] }),
    );

    expect([getCurrentStep(kept)?.id, kept.answers.q2, kept.results.q2]).toStrictEqual([
      "q2",
      draft,
      undefined,
    ]);
  });

  it("brings in the run's answers for screens the learner hasn't touched, keeping their draft", () => {
    const steps = [checkStep("q1"), explanationStep("e1"), checkStep("q2")];
    const draft = { kind: "check", optionId: "right" } as const;
    const drafted = play(steps, [{ answer: draft, stepId: "q1", type: "selectAnswer" }]);

    const started = lessonPlayerReducer(
      drafted,
      runStarted({ answers: [runAnswer("q2", true)], held: [] }),
    );

    expect([getCurrentStep(started)?.id, started.answers.q1, started.results.q1]).toStrictEqual([
      "q1",
      draft,
      undefined,
    ]);

    expect([started.results.q2?.isCorrect, started.firstVerdicts]).toStrictEqual([
      true,
      { q2: true },
    ]);

    const atQ2 = playOn(started, [
      { counts: true, result: stepResult(true), stepId: "q1", type: "checkResolved" },
      { type: "continue" },
      { type: "continue" },
    ]);

    expect([getCurrentStep(atQ2)?.id, atQ2.phase, atQ2.reviewing]).toStrictEqual([
      "q2",
      "feedback",
      true,
    ]);
  });

  it('brings in the run\'s answers while the learner is in "I already know this"', () => {
    const saved = {
      ...runAnswer("typed", true),
      answer: { kind: "typedAnswer", text: "Saved text" } as const,
    };

    const recovered = play(
      [explanationStep("e"), checkStep("q"), typedAnswerStep("typed")],
      [
        { type: "knowThis" },
        runStarted({ answers: [saved], held: [] }),
        ...answerCheck("q", false),
        { type: "continue" },
        { type: "continue" },
      ],
    );

    expect([getCurrentStep(recovered)?.id, recovered.phase]).toStrictEqual(["typed", "feedback"]);
    expect(recovered.answers.typed).toStrictEqual(saved.answer);
  });

  it("counts the run's first verdict on a screen where the learner keeps a draft", () => {
    const corrected = play(
      [checkStep("q1"), explanationStep("e"), checkStep("q2")],
      [
        { answer: { kind: "check", optionId: "right" }, stepId: "q1", type: "selectAnswer" },
        runStarted({ answers: [runAnswer("q1", false)], held: [] }),
        ...answerCheck("q1", true),
      ],
    );

    expect(corrected.firstVerdicts.q1).toBe(false);
    expect(getLessonScreen(corrected).segments[0]).toBe("wrong");
  });

  it("leaves a learner who pressed anything in the player where they are when a late run lands", () => {
    const steps = [explanationStep("e1"), checkStep("q1"), explanationStep("e2"), checkStep("q2")];
    const answers = [runAnswer("q1", true)];
    const untouched = lessonPlayerReducer(play(steps, []), runStarted({ answers, held: [] }));
    const engaged = play(steps, [{ type: "engaged" }, runStarted({ answers, held: [] })]);

    expect(getCurrentStep(untouched)?.id).toBe("e2");

    expect([getCurrentStep(engaged)?.id, engaged.results.q1?.isCorrect]).toStrictEqual([
      "e1",
      true,
    ]);
  });

  it("keeps the learner on the screen they moved to when a late run has it, before any answer", () => {
    const steps = [explanationStep("e1"), checkStep("q1"), explanationStep("e2"), checkStep("q2")];
    const atQ1 = play(steps, [{ type: "continue" }]);

    const kept = lessonPlayerReducer(
      atQ1,
      runStarted({ answers: [runAnswer("q1", true)], held: [] }),
    );

    expect([getCurrentStep(kept)?.id, kept.phase, kept.rounds.q1]).toStrictEqual([
      "q1",
      "playing",
      atQ1.rounds.q1,
    ]);

    expect(kept.firstVerdicts.q1).toBe(true);
  });

  it("leaves the screen in view as it is when a late run has it, since a canvas may hold unreported work", () => {
    const atQ2 = play(
      [checkStep("q1"), explanationStep("e1"), checkStep("q2"), summaryStep("sum")],
      [...answerCheck("q1", true), { type: "continue" }, { type: "continue" }],
    );

    const kept = lessonPlayerReducer(
      atQ2,
      runStarted({ answers: [runAnswer("q2", true)], held: [] }),
    );

    expect([getCurrentStep(kept)?.id, kept.phase, kept.rounds.q2]).toStrictEqual([
      "q2",
      "playing",
      atQ2.rounds.q2,
    ]);

    expect([kept.answers.q2, kept.results.q2, kept.firstVerdicts.q2]).toStrictEqual([
      undefined,
      undefined,
      true,
    ]);

    const miss = runAnswer("q1", false);

    const atRetry = play(
      [explanationStep("e1"), checkStep("q1"), explanationStep("e2"), checkStep("q2")],
      [
        { answers: [miss], type: "unsentPlaced" },
        { type: "continue" },
        ...answerCheck("q2", true),
        { type: "continue" },
      ],
    );

    expect([atRetry.queue, atRetry.position, atRetry.phase]).toStrictEqual([
      ["e1", "q1", "e2", "q2", "q1"],
      4,
      "playing",
    ]);

    const retry = lessonPlayerReducer(atRetry, runStarted({ answers: [miss], held: [] }));

    expect(retry).toMatchObject({
      phase: "playing",
      position: 4,
      queue: atRetry.queue,
      retried: ["q1"],
    });

    expect([retry.answers.q1, retry.results.q1]).toStrictEqual([undefined, undefined]);
  });

  it("drops a stale miss and its retry when the run has the right retry, keeping the learner's draft", () => {
    const steps = [
      explanationStep("e1"),
      checkStep("q1"),
      explanationStep("e2"),
      checkStep("q2"),
      summaryStep("sum"),
    ];

    const miss = runAnswer("q1", false);
    const draft = { kind: "check", optionId: "right" } as const;

    const drafted = play(steps, [
      { answers: [miss], type: "unsentPlaced" },
      { type: "continue" },
      { answer: draft, stepId: "q2", type: "selectAnswer" },
    ]);

    const started = lessonPlayerReducer(
      drafted,
      runStarted({ answers: [miss, runAnswer("q1", true, LATER)], held: [] }),
    );

    expect([getCurrentStep(started)?.id, started.answers.q2]).toStrictEqual(["q2", draft]);

    expect([started.results.q1?.isCorrect, started.queue, started.retried]).toStrictEqual([
      true,
      ["e1", "q1", "e2", "q2", "sum"],
      ["q1"],
    ]);
  });

  it("shows a screen's newest answer when this device still holds an older one the run already has", () => {
    const steps = [explanationStep("e1"), checkStep("q1"), explanationStep("e2"), checkStep("q2")];
    const miss = runAnswer("q1", false);

    const started = play(steps, [
      runStarted({ answers: [miss, runAnswer("q1", true, LATER)], held: [miss] }),
    ]);

    expect([getCurrentStep(started)?.id, started.queue]).toStrictEqual([
      "e2",
      ["e1", "q1", "e2", "q2"],
    ]);

    expect([started.results.q1?.isCorrect, started.answers.q1]).toStrictEqual([
      true,
      { kind: "check", optionId: "right" },
    ]);
  });

  it("starts over only the screens whose shown answer a fresher run replaces", () => {
    const steps = [
      checkStep("q1"),
      explanationStep("e1"),
      fillBlankStep("blank"),
      explanationStep("e2"),
      checkStep("q2"),
    ];

    const right = runAnswer("q1", true);

    const miss = blankAnswer("rent", false);

    const reviewing = play(steps, [
      { answers: [right, miss], type: "unsentPlaced" },
      { direction: "prev", type: "navigate" },
    ]);

    expect([getCurrentStep(reviewing)?.id, reviewing.phase]).toStrictEqual(["blank", "feedback"]);

    const refreshed = lessonPlayerReducer(
      reviewing,
      runStarted({ answers: [right, miss, blankAnswer("pay", true, LATER)], held: [] }),
    );

    expect([refreshed.answers.blank, refreshed.results.blank?.isCorrect]).toStrictEqual([
      { kind: "fillBlank", userAnswers: ["pay"] },
      true,
    ]);

    expect(refreshed.rounds.blank).not.toBe(reviewing.rounds.blank);
    expect(refreshed.rounds.q1).toBe(reviewing.rounds.q1);
  });

  it("keeps a reviewed screen as it was when a finished lesson comes back to a screen it still needs", () => {
    const steps = [explanationStep("e1"), checkStep("q1"), explanationStep("e2"), checkStep("q2")];

    const finished = play(steps, [
      { type: "continue" },
      ...answerCheck("q1", true),
      { type: "continue" },
      { type: "continue" },
      ...answerCheck("q2", true),
      { type: "continue" },
    ]);

    const recovered = lessonPlayerReducer(finished, {
      answers: [runAnswer("q1", true)],
      type: "runResynced",
    });

    expect([getCurrentStep(recovered)?.id, recovered.rounds.q1]).toStrictEqual([
      "q2",
      finished.rounds.q1,
    ]);

    expect(recovered.rounds.q2).not.toBe(finished.rounds.q2);
  });

  it("shows an answer this device still holds with the verdict the device gave it", () => {
    const steps = [checkStep("q1"), explanationStep("e1"), checkStep("q2")];

    const held = toRunAnswer({
      check: {
        answer: { kind: "check", optionId: "wrong" },
        answeredAt: ANSWERED_AT,
        attemptId: "held",
        durationMs: 1000,
        isCorrect: false,
        stepId: "q1",
        usedHelp: false,
      },
      lesson: { id: "lesson", language: "en", steps },
    });

    const placed = play(steps, [{ answers: [held], type: "unsentPlaced" }]);
    const back = lessonPlayerReducer(placed, { direction: "prev", type: "navigate" });

    expect([getCurrentStep(back)?.id, back.phase, back.answers.q1]).toStrictEqual([
      "q1",
      "feedback",
      { kind: "check", optionId: "wrong" },
    ]);

    expect(back.results.q1).toMatchObject({ correctAnswer: "Right", isCorrect: false });
  });

  it("places a learner who comes back after the answers this device still holds", () => {
    const steps = [
      explanationStep("e1"),
      checkStep("q1"),
      explanationStep("e2"),
      checkStep("q2"),
      explanationStep("e3"),
      checkStep("q3"),
    ];

    const placed = play(steps, [
      { answers: [runAnswer("q1", true), runAnswer("q2", false)], type: "unsentPlaced" },
    ]);

    expect(placed).toMatchObject({
      firstVerdicts: { q1: true, q2: false },
      queue: ["e1", "q1", "e2", "q2", "e3", "q3", "q2"],
      unsavedAnswers: false,
    });

    expect(getCurrentStep(placed)?.id).toBe("e3");

    const answeredHere = play(steps, [
      { type: "continue" },
      ...answerCheck("q1", true),
      { answers: [runAnswer("q2", false)], type: "unsentPlaced" },
    ]);

    expect(getCurrentStep(answeredHere)?.id).toBe("q1");
  });

  it("keeps a learner on the answer they arrived with when held answers or the run would move them", () => {
    const steps = [checkStep("q1"), explanationStep("e1"), checkStep("q2")];
    const arrivedWith: LessonPlayerAnswer = { kind: "check", optionId: "right" };
    const answered = [runAnswer("q1", true)];

    const placed = play(steps, [
      { answer: arrivedWith, stepId: "q1", type: "selectAnswer" },
      { answers: answered, type: "unsentPlaced" },
    ]);

    const started = lessonPlayerReducer(placed, runStarted({ answers: answered, held: [] }));

    expect([getCurrentStep(started)?.id, started.answers]).toStrictEqual([
      "q1",
      { q1: arrivedWith },
    ]);
  });

  it("keeps the learner in place when the run counts the answers still held on the device", () => {
    const steps = [explanationStep("e1"), checkStep("q1"), explanationStep("e2"), checkStep("q2")];
    const held = [runAnswer("q1", false)];
    const placed = play(steps, [{ answers: held, type: "unsentPlaced" }]);

    const started = lessonPlayerReducer(placed, runStarted({ answers: [], held }));

    expect(started).toMatchObject({
      position: placed.position,
      queue: placed.queue,
      rounds: placed.rounds,
      run: { carriedStepIds: [], runId: "run", status: "started" },
    });
  });

  it("brings back a miss counted twice because its saved reply was lost, without moving the learner", () => {
    const steps = [
      explanationStep("e1"),
      checkStep("q1"),
      explanationStep("e2"),
      checkStep("q2"),
      summaryStep("sum"),
    ];

    const miss = runAnswer("q1", false);
    const placed = play(steps, [{ answers: [miss, miss], type: "unsentPlaced" }]);
    const reading = lessonPlayerReducer(placed, { type: "continue" });

    expect([reading.queue, getCurrentStep(reading)?.id]).toStrictEqual([
      ["e1", "q1", "e2", "q2", "sum"],
      "q2",
    ]);

    const started = lessonPlayerReducer(reading, runStarted({ answers: [miss], held: [] }));

    expect(started).toMatchObject({
      position: reading.position,
      queue: ["e1", "q1", "e2", "q2", "sum", "q1"],
      retried: ["q1"],
      rounds: reading.rounds,
    });

    const lastLeft = play(
      [explanationStep("e1"), checkStep("q1"), summaryStep("sum")],
      [{ answers: [miss, miss], type: "unsentPlaced" }],
    );

    expect(lastLeft.phase).toBe("completed");

    const retry = lessonPlayerReducer(lastLeft, runStarted({ answers: [miss], held: [] }));

    expect([retry.phase, retry.queue, getCurrentStep(retry)?.id]).toStrictEqual([
      "playing",
      ["e1", "q1", "sum", "q1"],
      "sum",
    ]);
  });

  it("carries over only the answers the server has from an earlier sitting", () => {
    const earlier = "2026-10-04T10:00:00.000Z";

    const started = play(
      [checkStep("q1"), checkStep("q2")],
      [
        { answers: [runAnswer("q2", true, earlier)], type: "unsentPlaced" },
        runStarted({
          answers: [runAnswer("q1", true, earlier)],
          held: [runAnswer("q2", true, earlier)],
        }),
      ],
    );

    expect(started.run).toMatchObject({ carriedStepIds: ["q1"] });
  });

  it("says answers aren't saved yet from a save that didn't get through until all are saved", () => {
    const failed = play([checkStep("q1")], [{ type: "saveFailed" }]);
    expect(failed.unsavedAnswers).toBe(true);
    expect(lessonPlayerReducer(failed, { type: "allSaved" }).unsavedAnswers).toBe(false);
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
      attemptId: "quiz-attempt",
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

  it("keeps a newer answer's verdict when the server's word on an earlier answer comes late", () => {
    const again = play(
      [checkStep("quiz")],
      [...answerCheck("quiz", true, "first"), ...answerCheck("quiz", true, "second")],
    );

    expect(again.results.quiz?.attemptId).toBe("second");

    const late = lessonPlayerReducer(again, {
      attemptId: "first",
      result: {
        ...stepResult(false),
        nextReviewAt: "2026-10-02T00:00:00.000Z",
        savedMistake: true,
      },
      stepId: "quiz",
      type: "checkConfirmed",
    });

    expect(late.results.quiz).toStrictEqual(again.results.quiz);
  });

  it("tracks the run and the completion as the server answers", () => {
    const hyperdrive = { knownStepIds: [], streak: 2 };

    const done = play(
      [explanationStep("e")],
      [
        { type: "runStarting" },
        {
          answers: [],
          held: [],
          hyperdrive,
          replay: false,
          runId: "run-1",
          startedAt: STARTED_AT,
          type: "runStarted",
        },
        { type: "continue" },
        { type: "completionFailed" },
        { type: "completionRetried" },
      ],
    );

    expect([done.run, done.completion?.status]).toStrictEqual([
      { carriedStepIds: [], hyperdrive, replay: false, runId: "run-1", status: "started" },
      "saving",
    ]);
  });
});
