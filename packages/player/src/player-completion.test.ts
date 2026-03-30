import { describe, expect, test } from "vitest";
import { computeLocalCompletion } from "./player-completion";
import { type PlayerState } from "./player-reducer";
import { type SerializedStep } from "./prepare-activity-data";

function buildStep(overrides: Partial<SerializedStep> = {}): SerializedStep {
  return {
    content: { text: "Hello", title: "Intro", variant: "text" as const },
    fillBlankOptions: [],
    id: "step-1",
    kind: "static",
    matchColumnsRightItems: [],
    position: 0,
    sentence: null,
    sentenceWordOptions: [],
    sortOrderItems: [],
    translationOptions: [],
    vocabularyOptions: [],
    word: null,
    wordBankOptions: [],
    ...overrides,
  };
}

function buildState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    activityId: "activity-1",
    completion: null,
    currentStepIndex: 0,
    phase: "completed",
    results: {},
    selectedAnswers: {},
    startedAt: Date.now(),
    stepStartedAt: Date.now(),
    stepTimings: {},
    steps: [buildStep()],
    totalBrainPower: 0,
    ...overrides,
  };
}

describe(computeLocalCompletion, () => {
  test("uses standard scoring for non-tradeoff activities", () => {
    const state = buildState({
      results: {
        "step-1": {
          answer: { kind: "multipleChoice", selectedIndex: 0, selectedText: "A" },
          result: { correctAnswer: "A", feedback: null, isCorrect: true },
          stepId: "step-1",
        },
      },
      steps: [buildStep({ id: "step-1", kind: "multipleChoice" })],
      totalBrainPower: 50,
    });

    const result = computeLocalCompletion(state);

    expect(result.brainPower).toBe(10);
    expect(result.newTotalBp).toBe(60);
  });

  test("uses boosted scoring (100 BP, 5 energy) for tradeoff activities", () => {
    const tradeoffContent = {
      event: null,
      outcomes: [],
      priorities: [
        { description: "d", id: "study", name: "Study" },
        { description: "d", id: "exercise", name: "Exercise" },
        { description: "d", id: "sleep", name: "Sleep" },
      ],
      resource: { name: "hours", total: 5 },
      stateModifiers: null,
      tokenOverride: null,
    };

    const state = buildState({
      results: {
        "step-1": {
          answer: {
            allocations: [
              { priorityId: "study", tokens: 3 },
              { priorityId: "exercise", tokens: 1 },
              { priorityId: "sleep", tokens: 1 },
            ],
            kind: "tradeoff",
          },
          result: { correctAnswer: null, feedback: null, isCorrect: true },
          stepId: "step-1",
        },
      },
      steps: [
        buildStep({ id: "intro", kind: "static", position: 0 }),
        buildStep({ content: tradeoffContent, id: "step-1", kind: "tradeoff", position: 1 }),
        buildStep({ id: "reflection", kind: "static", position: 2 }),
      ],
      totalBrainPower: 200,
    });

    const result = computeLocalCompletion(state);

    expect(result.brainPower).toBe(100);
    expect(result.energyDelta).toBe(5);
    expect(result.newTotalBp).toBe(300);
  });

  test("detects tradeoff activity even when mixed with static steps", () => {
    const tradeoffContent = {
      event: null,
      outcomes: [],
      priorities: [
        { description: "d", id: "study", name: "Study" },
        { description: "d", id: "exercise", name: "Exercise" },
        { description: "d", id: "sleep", name: "Sleep" },
      ],
      resource: { name: "hours", total: 5 },
      stateModifiers: null,
      tokenOverride: null,
    };

    const state = buildState({
      steps: [
        buildStep({ id: "intro", kind: "static", position: 0 }),
        buildStep({ content: tradeoffContent, id: "r1", kind: "tradeoff", position: 1 }),
        buildStep({ content: tradeoffContent, id: "r2", kind: "tradeoff", position: 2 }),
        buildStep({ id: "reflection", kind: "static", position: 3 }),
      ],
    });

    const result = computeLocalCompletion(state);
    expect(result.brainPower).toBe(100);
  });
});
