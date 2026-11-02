import { type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { describe, expect, it } from "vitest";
import {
  checkpointDuelReducer,
  createDuelState,
  getCurrentQuestion,
  getDuelScore,
} from "./checkpoint-duel-state";

function question(itemId: string, answered: { blank: boolean; isCorrect: boolean } | null = null) {
  return {
    answered,
    capsuleKey: null,
    citation: null,
    context: null,
    drill: null,
    entry: null,
    format: "multipleChoice" as const,
    image: null,
    itemId,
    left: null,
    mistakeId: null,
    options: ["Right", "Wrong"],
    placement: false,
    question: `Question ${itemId}?`,
    quoted: false,
    right: null,
    select: 1 as const,
    set: null,
    skillId: "skill",
    timeMachine: null,
    unit: null,
    visual: null,
  };
}

function checkpoint(overrides: Partial<CheckpointView> = {}): CheckpointView {
  return {
    blockId: "block",
    checklist: [],
    kind: "boss",
    mock: false,
    nextPhase: null,
    passMark: 2,
    phase: null,
    planItemId: "plan-item",
    questions: [question("a"), question("b"), question("c")],
    reinforcementLessons: 2,
    rematch: false,
    result: null,
    retry: null,
    reward: { badge: true, brainPower: 200, glasses: null, phaseComplete: true },
    sessionId: "session",
    status: "active",
    timeLimitMinutes: null,
    title: null,
    trueFalseLabels: "trueFalse",
    ...overrides,
  };
}

describe(createDuelState, () => {
  it("opens on the first question, where the learner left the duel, or on a finished result", () => {
    expect(createDuelState(checkpoint())).toMatchObject({ phase: "duel", verdicts: {} });

    const resumed = createDuelState(
      checkpoint({ questions: [question("a", { blank: false, isCorrect: true }), question("b")] }),
    );

    expect(resumed).toMatchObject({ phase: "duel", verdicts: { a: true } });
    expect(createDuelState(checkpoint({ status: "completed" })).phase).toBe("result");
  });

  it("opens a checkpoint set aside after its questions were removed on its result", () => {
    expect(
      createDuelState(checkpoint({ endedWithoutQuestions: true, questions: [], status: "skipped" }))
        .phase,
    ).toBe("result");
  });
});

describe(checkpointDuelReducer, () => {
  it("shows each verdict until the learner moves on, then asks the next question", () => {
    const view = checkpoint();

    const picked = checkpointDuelReducer(createDuelState(view), {
      answer: { selectedIndex: 1 },
      type: "select",
    });

    const answered = checkpointDuelReducer(picked, {
      isCorrect: false,
      itemId: "a",
      recording: null,
      reinforcementLessons: 1,
      type: "answered",
    });

    expect(answered).toMatchObject({
      feedback: { answer: { selectedIndex: 1 }, isCorrect: false, itemId: "a" },
      reinforcementLessons: 1,
      selected: null,
    });

    expect(getCurrentQuestion({ checkpoint: view, state: answered })?.itemId).toBe("a");

    expect(
      checkpointDuelReducer(answered, { answer: { selectedIndex: 0 }, type: "select" }).selected,
    ).toBeNull();

    const next = checkpointDuelReducer(answered, { type: "next" });

    expect(getCurrentQuestion({ checkpoint: view, state: next })?.itemId).toBe("b");

    expect(getDuelScore({ checkpoint: view, state: next })).toStrictEqual({
      answered: 1,
      correct: 0,
      decision: null,
      done: false,
      questions: 3,
    });
  });

  it("ends a boss's duel once the shield breaks, and only a boss's", () => {
    const right = { blank: false, isCorrect: true };
    const questions = [question("a", right), question("b"), question("c")];
    const boss = checkpoint({ questions });

    const confirmed = checkpointDuelReducer(createDuelState(boss), {
      answer: { selectedIndex: 0 },
      type: "confirm",
    });

    const winning = checkpointDuelReducer(confirmed, {
      isCorrect: true,
      itemId: "b",
      recording: null,
      reinforcementLessons: 1,
      type: "answered",
    });

    expect(getCurrentQuestion({ checkpoint: boss, state: winning })?.itemId).toBe("b");

    expect(getDuelScore({ checkpoint: boss, state: winning })).toMatchObject({
      decision: "won",
      done: true,
    });

    const after = checkpointDuelReducer(winning, { type: "next" });
    expect(getCurrentQuestion({ checkpoint: boss, state: after })).toBeNull();

    const weekly = checkpoint({ kind: "weekly", questions });
    const weeklyAfter = checkpointDuelReducer(winning, { type: "next" });

    expect(getDuelScore({ checkpoint: weekly, state: weeklyAfter })).toMatchObject({
      decision: null,
      done: false,
    });

    expect(getCurrentQuestion({ checkpoint: weekly, state: weeklyAfter })?.itemId).toBe("c");
  });

  it("ends a boss's duel once it can't be won anymore, and only a boss's", () => {
    const wrong = { blank: false, isCorrect: false };
    const questions = [question("a", wrong), question("b"), question("c")];
    const boss = checkpoint({ questions });
    const missedOne = createDuelState(boss);

    expect(getDuelScore({ checkpoint: boss, state: missedOne })).toMatchObject({
      decision: null,
      done: false,
    });

    const losing = checkpointDuelReducer(
      checkpointDuelReducer(missedOne, { answer: { selectedIndex: 1 }, type: "confirm" }),
      { isCorrect: false, itemId: "b", recording: null, reinforcementLessons: 1, type: "answered" },
    );

    expect(getCurrentQuestion({ checkpoint: boss, state: losing })?.itemId).toBe("b");

    expect(getDuelScore({ checkpoint: boss, state: losing })).toStrictEqual({
      answered: 2,
      correct: 0,
      decision: "lost",
      done: true,
      questions: 3,
    });

    const after = checkpointDuelReducer(losing, { type: "next" });
    expect(getCurrentQuestion({ checkpoint: boss, state: after })).toBeNull();

    const weekly = checkpoint({ kind: "weekly", questions });

    expect(getDuelScore({ checkpoint: weekly, state: after })).toMatchObject({
      decision: null,
      done: false,
    });

    expect(getCurrentQuestion({ checkpoint: weekly, state: after })?.itemId).toBe("c");
  });

  it("keeps a recording's transcript from the answer that finished its questions", () => {
    const transcript = [{ speaker: "Tom", text: "Thursday the twelfth." }];

    const picked = checkpointDuelReducer(createDuelState(checkpoint()), {
      answer: { text: "Thursday" },
      type: "select",
    });

    const answered = checkpointDuelReducer(picked, {
      isCorrect: true,
      itemId: "a",
      recording: { setId: "recording", transcript },
      reinforcementLessons: 0,
      type: "answered",
    });

    expect(answered).toMatchObject({
      feedback: { answer: { text: "Thursday" }, isCorrect: true },
      transcripts: { recording: transcript },
    });

    const next = checkpointDuelReducer(checkpointDuelReducer(answered, { type: "next" }), {
      answer: { selectedIndex: 0 },
      type: "select",
    });

    expect(
      checkpointDuelReducer(next, {
        isCorrect: true,
        itemId: "b",
        recording: null,
        reinforcementLessons: 1,
        type: "answered",
      }).transcripts,
    ).toStrictEqual({ recording: transcript });
  });

  it("grades the confirmed pick, which can't change while it's on its way", () => {
    const picked = checkpointDuelReducer(createDuelState(checkpoint()), {
      answer: { selectedIndex: 1 },
      type: "select",
    });

    const confirmed = checkpointDuelReducer(picked, {
      answer: { selectedIndex: 1 },
      type: "confirm",
    });

    const tapped = checkpointDuelReducer(confirmed, {
      answer: { selectedIndex: 2 },
      type: "select",
    });

    expect(tapped).toMatchObject({ pending: true, selected: { selectedIndex: 1 } });

    const answered = checkpointDuelReducer(tapped, {
      isCorrect: true,
      itemId: "a",
      recording: null,
      reinforcementLessons: 1,
      type: "answered",
    });

    expect(answered).toMatchObject({
      confirmed: null,
      feedback: { answer: { selectedIndex: 1 }, isCorrect: true, itemId: "a" },
      pending: false,
    });
  });

  it("keeps the pick after a failed answer, so Try again sends it again", () => {
    const picked = checkpointDuelReducer(createDuelState(checkpoint()), {
      answer: { selectedIndex: 0 },
      type: "select",
    });

    const failed = checkpointDuelReducer(
      checkpointDuelReducer(picked, { answer: { selectedIndex: 0 }, type: "confirm" }),
      { error: "answer", type: "failed" },
    );

    expect(failed).toMatchObject({
      confirmed: null,
      error: "answer",
      pending: false,
      selected: { selectedIndex: 0 },
    });
  });

  it("keeps the state and reports a failed request so the learner can try again", () => {
    const pending = checkpointDuelReducer(createDuelState(checkpoint()), { type: "pending" });
    const failed = checkpointDuelReducer(pending, { error: "answer", type: "failed" });

    expect(failed).toMatchObject({ error: "answer", pending: false, phase: "duel" });
    expect(checkpointDuelReducer(failed, { type: "pending" }).error).toBeNull();
  });
});

describe(getDuelScore, () => {
  it("keeps an answered question's verdict when its content was removed", () => {
    const view = checkpoint({
      answeredQuestions: [
        { isCorrect: false, itemId: "removed" },
        { isCorrect: false, itemId: "b" },
      ],
      passMark: 5,
      questions: [
        question("b", { blank: false, isCorrect: false }),
        question("c"),
        question("d"),
        question("e"),
        question("f"),
      ],
    });

    const state = createDuelState(view);

    expect(getDuelScore({ checkpoint: view, state })).toStrictEqual({
      answered: 2,
      correct: 0,
      decision: "lost",
      done: true,
      questions: 6,
    });

    expect(getCurrentQuestion({ checkpoint: view, state })).toBeNull();
  });

  it("is done once every question has a verdict", () => {
    const view = checkpoint({
      questions: [
        question("a", { blank: false, isCorrect: true }),
        question("b", { blank: false, isCorrect: true }),
      ],
    });

    expect(getDuelScore({ checkpoint: view, state: createDuelState(view) })).toStrictEqual({
      answered: 2,
      correct: 2,
      decision: "won",
      done: true,
      questions: 2,
    });
  });
});
