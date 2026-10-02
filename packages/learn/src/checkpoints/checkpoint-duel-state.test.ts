import { type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { describe, expect, it } from "vitest";
import {
  checkpointDuelReducer,
  createDuelState,
  getCurrentQuestion,
  getDuelScore,
} from "./checkpoint-duel-state";

function question(itemId: string, answered: { isCorrect: boolean } | null = null) {
  return {
    answered,
    capsuleKey: null,
    citation: null,
    context: null,
    drill: null,
    format: "multipleChoice" as const,
    itemId,
    left: null,
    mistakeId: null,
    options: ["Right", "Wrong"],
    placement: false,
    question: `Question ${itemId}?`,
    quoted: false,
    right: null,
    skillId: "skill",
    timeMachine: null,
    unit: null,
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
    questions: [question("a"), question("b"), question("c")],
    reinforcementLessons: 2,
    rematch: false,
    result: null,
    reward: { badge: true, brainPower: 200, glasses: null, phaseComplete: true },
    sessionId: "session",
    status: "pending",
    timeLimitMinutes: null,
    title: null,
    trueFalseLabels: "trueFalse",
    ...overrides,
  };
}

describe(createDuelState, () => {
  it("opens on the intro, where the learner left the duel, or on a finished result", () => {
    expect(createDuelState(checkpoint()).phase).toBe("intro");

    const resumed = createDuelState(
      checkpoint({ questions: [question("a", { isCorrect: true }), question("b")] }),
    );

    expect(resumed).toMatchObject({ phase: "duel", verdicts: { a: true } });
    expect(createDuelState(checkpoint({ status: "completed" })).phase).toBe("result");
  });
});

describe(checkpointDuelReducer, () => {
  it("shows each verdict until the learner moves on, then asks the next question", () => {
    const view = checkpoint();
    const started = checkpointDuelReducer(createDuelState(view), { type: "started" });
    const picked = checkpointDuelReducer(started, { answer: { selectedIndex: 1 }, type: "select" });

    const answered = checkpointDuelReducer(picked, {
      isCorrect: false,
      itemId: "a",
      type: "answered",
    });

    expect(answered).toMatchObject({
      feedback: { answer: { selectedIndex: 1 }, isCorrect: false, itemId: "a" },
      selected: null,
    });

    expect(getCurrentQuestion({ checkpoint: view, state: answered })?.itemId).toBe("a");

    // A verdict can't be changed by picking again.
    expect(
      checkpointDuelReducer(answered, { answer: { selectedIndex: 0 }, type: "select" }).selected,
    ).toBeNull();

    const next = checkpointDuelReducer(answered, { type: "next" });

    expect(getCurrentQuestion({ checkpoint: view, state: next })?.itemId).toBe("b");

    expect(getDuelScore({ checkpoint: view, state: next })).toStrictEqual({
      answered: 1,
      correct: 0,
      done: false,
    });
  });

  it("keeps the state and reports a failed request so the learner can try again", () => {
    const pending = checkpointDuelReducer(createDuelState(checkpoint()), { type: "pending" });
    const failed = checkpointDuelReducer(pending, { error: "start", type: "failed" });

    expect(failed).toMatchObject({ error: "start", pending: false, phase: "intro" });
    expect(checkpointDuelReducer(failed, { type: "pending" }).error).toBeNull();
  });
});

describe(getDuelScore, () => {
  it("is done once every question has a verdict", () => {
    const view = checkpoint({
      questions: [question("a", { isCorrect: true }), question("b", { isCorrect: true })],
    });

    expect(getDuelScore({ checkpoint: view, state: createDuelState(view) })).toStrictEqual({
      answered: 2,
      correct: 2,
      done: true,
    });
  });
});
