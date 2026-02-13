import {
  type SerializedActivity,
  type SerializedStep,
} from "@/data/activities/prepare-activity-data";
import { describe, expect, test } from "vitest";
import {
  type PlayerAction,
  type PlayerState,
  type SelectedAnswer,
  type StepResult,
  createInitialState,
  playerReducer,
} from "./player-reducer";

function buildStep(overrides: Partial<SerializedStep> = {}): SerializedStep {
  return {
    content: { text: "Hello", title: "Intro", variant: "text" as const },
    id: "step-1",
    kind: "static",
    position: 0,
    sentence: null,
    visualContent: null,
    visualKind: null,
    word: null,
    ...overrides,
  };
}

function buildActivity(overrides: Partial<SerializedActivity> = {}): SerializedActivity {
  return {
    description: null,
    id: "activity-1",
    kind: "core",
    language: "en",
    lessonSentences: [],
    lessonWords: [],
    organizationId: 1,
    steps: [buildStep()],
    title: "Test Activity",
    ...overrides,
  };
}

function buildState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    activityId: "activity-1",
    currentStepIndex: 0,
    dimensions: {},
    phase: "playing",
    results: {},
    selectedAnswers: {},
    steps: [buildStep()],
    ...overrides,
  };
}

const mcAnswer: SelectedAnswer = { kind: "multipleChoice", selectedIndex: 0 };

describe(createInitialState, () => {
  test("sets phase to playing and index to 0", () => {
    const activity = buildActivity();
    const state = createInitialState(activity);
    expect(state.phase).toBe("playing");
    expect(state.currentStepIndex).toBe(0);
  });

  test("copies activityId and steps", () => {
    const steps = [buildStep({ id: "s1" }), buildStep({ id: "s2", position: 1 })];
    const activity = buildActivity({ steps });
    const state = createInitialState(activity);
    expect(state.activityId).toBe("activity-1");
    expect(state.steps).toEqual(steps);
  });

  test("initializes empty maps", () => {
    const state = createInitialState(buildActivity());
    expect(state.selectedAnswers).toEqual({});
    expect(state.results).toEqual({});
    expect(state.dimensions).toEqual({});
  });
});

describe("SELECT_ANSWER", () => {
  test("stores answer by stepId", () => {
    const state = buildState();
    const next = playerReducer(state, {
      answer: mcAnswer,
      stepId: "step-1",
      type: "SELECT_ANSWER",
    });
    expect(next.selectedAnswers["step-1"]).toEqual(mcAnswer);
  });

  test("does not change phase or index", () => {
    const state = buildState();
    const next = playerReducer(state, {
      answer: mcAnswer,
      stepId: "step-1",
      type: "SELECT_ANSWER",
    });
    expect(next.phase).toBe("playing");
    expect(next.currentStepIndex).toBe(0);
  });

  test("overwrites previous answer for same step", () => {
    const state = buildState({
      selectedAnswers: { "step-1": { kind: "multipleChoice", selectedIndex: 1 } },
    });
    const next = playerReducer(state, {
      answer: mcAnswer,
      stepId: "step-1",
      type: "SELECT_ANSWER",
    });
    expect(next.selectedAnswers["step-1"]).toEqual(mcAnswer);
  });
});

describe("CHECK_ANSWER", () => {
  test("transitions from playing to feedback and stores result", () => {
    const step = buildStep({ id: "mc-1", kind: "multipleChoice" });
    const state = buildState({ steps: [step] });
    const next = playerReducer(state, {
      effects: [],
      result: { feedback: "Correct!", isCorrect: true },
      stepId: "mc-1",
      type: "CHECK_ANSWER",
    });
    expect(next.phase).toBe("feedback");
    expect(next.results["mc-1"]).toEqual({
      answer: undefined,
      effects: [],
      result: { feedback: "Correct!", isCorrect: true },
      stepId: "mc-1",
    });
  });

  test("includes selected answer in the result", () => {
    const step = buildStep({ id: "mc-1", kind: "multipleChoice" });
    const state = buildState({
      selectedAnswers: { "mc-1": mcAnswer },
      steps: [step],
    });
    const next = playerReducer(state, {
      effects: [],
      result: { feedback: "Correct!", isCorrect: true },
      stepId: "mc-1",
      type: "CHECK_ANSWER",
    });
    expect(next.results["mc-1"]?.answer).toEqual(mcAnswer);
  });

  test("applies positive effect to dimensions", () => {
    const state = buildState();
    const next = playerReducer(state, {
      effects: [{ dimension: "Quality", impact: "positive" }],
      result: { feedback: null, isCorrect: true },
      stepId: "step-1",
      type: "CHECK_ANSWER",
    });
    expect(next.dimensions).toEqual({ Quality: 1 });
  });

  test("applies negative effect to dimensions", () => {
    const state = buildState();
    const next = playerReducer(state, {
      effects: [{ dimension: "Quality", impact: "negative" }],
      result: { feedback: null, isCorrect: true },
      stepId: "step-1",
      type: "CHECK_ANSWER",
    });
    expect(next.dimensions).toEqual({ Quality: -1 });
  });

  test("applies neutral effect (zero change)", () => {
    const state = buildState();
    const next = playerReducer(state, {
      effects: [{ dimension: "Quality", impact: "neutral" }],
      result: { feedback: null, isCorrect: true },
      stepId: "step-1",
      type: "CHECK_ANSWER",
    });
    expect(next.dimensions).toEqual({ Quality: 0 });
  });

  test("accumulates effects on same dimension across multiple calls", () => {
    const steps = [
      buildStep({ id: "s1", kind: "multipleChoice" }),
      buildStep({ id: "s2", kind: "multipleChoice", position: 1 }),
    ];
    let state = buildState({ steps });
    state = playerReducer(state, {
      effects: [{ dimension: "Quality", impact: "positive" }],
      result: { feedback: null, isCorrect: true },
      stepId: "s1",
      type: "CHECK_ANSWER",
    });
    // Simulate continue + next step
    state = { ...state, currentStepIndex: 1, phase: "playing" };
    state = playerReducer(state, {
      effects: [{ dimension: "Quality", impact: "positive" }],
      result: { feedback: null, isCorrect: true },
      stepId: "s2",
      type: "CHECK_ANSWER",
    });
    expect(state.dimensions).toEqual({ Quality: 2 });
  });

  test("no-ops in feedback phase", () => {
    const state = buildState({ phase: "feedback" });
    const next = playerReducer(state, {
      effects: [],
      result: { feedback: null, isCorrect: true },
      stepId: "step-1",
      type: "CHECK_ANSWER",
    });
    expect(next).toBe(state);
  });

  test("no-ops in completed phase", () => {
    const state = buildState({ phase: "completed" });
    const next = playerReducer(state, {
      effects: [],
      result: { feedback: null, isCorrect: true },
      stepId: "step-1",
      type: "CHECK_ANSWER",
    });
    expect(next).toBe(state);
  });
});

describe("CONTINUE", () => {
  test("advances from feedback to playing on next step", () => {
    const steps = [buildStep({ id: "s1" }), buildStep({ id: "s2", position: 1 })];
    const state = buildState({ currentStepIndex: 0, phase: "feedback", steps });
    const next = playerReducer(state, { type: "CONTINUE" });
    expect(next.phase).toBe("playing");
    expect(next.currentStepIndex).toBe(1);
  });

  test("sets completed when on last step", () => {
    const state = buildState({ currentStepIndex: 0, phase: "feedback", steps: [buildStep()] });
    const next = playerReducer(state, { type: "CONTINUE" });
    expect(next.phase).toBe("completed");
  });

  test("no-ops in playing phase", () => {
    const state = buildState({ phase: "playing" });
    const next = playerReducer(state, { type: "CONTINUE" });
    expect(next).toBe(state);
  });

  test("no-ops in completed phase", () => {
    const state = buildState({ phase: "completed" });
    const next = playerReducer(state, { type: "CONTINUE" });
    expect(next).toBe(state);
  });
});

describe("NAVIGATE_STEP", () => {
  const staticSteps = [
    buildStep({ id: "s1", kind: "static", position: 0 }),
    buildStep({ id: "s2", kind: "static", position: 1 }),
    buildStep({ id: "s3", kind: "static", position: 2 }),
  ];

  test("next advances on static step", () => {
    const state = buildState({ currentStepIndex: 0, steps: staticSteps });
    const next = playerReducer(state, { direction: "next", type: "NAVIGATE_STEP" });
    expect(next.currentStepIndex).toBe(1);
    expect(next.phase).toBe("playing");
  });

  test("prev goes back on static step", () => {
    const state = buildState({ currentStepIndex: 1, steps: staticSteps });
    const next = playerReducer(state, { direction: "prev", type: "NAVIGATE_STEP" });
    expect(next.currentStepIndex).toBe(0);
  });

  test("prev clamps at 0", () => {
    const state = buildState({ currentStepIndex: 0, steps: staticSteps });
    const next = playerReducer(state, { direction: "prev", type: "NAVIGATE_STEP" });
    expect(next.currentStepIndex).toBe(0);
  });

  test("next past last step transitions to completed", () => {
    const state = buildState({ currentStepIndex: 2, steps: staticSteps });
    const next = playerReducer(state, { direction: "next", type: "NAVIGATE_STEP" });
    expect(next.phase).toBe("completed");
  });

  test("prev from last step goes back", () => {
    const state = buildState({ currentStepIndex: 2, steps: staticSteps });
    const next = playerReducer(state, { direction: "prev", type: "NAVIGATE_STEP" });
    expect(next.currentStepIndex).toBe(1);
    expect(next.phase).toBe("playing");
  });

  test("no-ops on interactive step", () => {
    const steps = [buildStep({ id: "mc-1", kind: "multipleChoice" })];
    const state = buildState({ steps });
    const next = playerReducer(state, { direction: "next", type: "NAVIGATE_STEP" });
    expect(next).toBe(state);
  });

  test("no-ops in feedback phase", () => {
    const state = buildState({ phase: "feedback", steps: staticSteps });
    const next = playerReducer(state, { direction: "next", type: "NAVIGATE_STEP" });
    expect(next).toBe(state);
  });

  test("no-ops in completed phase", () => {
    const state = buildState({ phase: "completed", steps: staticSteps });
    const next = playerReducer(state, { direction: "next", type: "NAVIGATE_STEP" });
    expect(next).toBe(state);
  });
});

describe("COMPLETE", () => {
  test("sets completed from playing", () => {
    const state = buildState({ phase: "playing" });
    const next = playerReducer(state, { type: "COMPLETE" });
    expect(next.phase).toBe("completed");
  });

  test("sets completed from feedback", () => {
    const state = buildState({ phase: "feedback" });
    const next = playerReducer(state, { type: "COMPLETE" });
    expect(next.phase).toBe("completed");
  });

  test("no-ops when already completed", () => {
    const state = buildState({ phase: "completed" });
    const next = playerReducer(state, { type: "COMPLETE" });
    expect(next).toBe(state);
  });
});

describe("RESTART", () => {
  test("resets to playing with index 0 from completed state", () => {
    const steps = [
      buildStep({ id: "s1", kind: "multipleChoice" }),
      buildStep({ id: "s2", kind: "multipleChoice", position: 1 }),
    ];
    const state = buildState({
      currentStepIndex: 1,
      phase: "completed",
      results: {
        s1: {
          answer: mcAnswer,
          effects: [],
          result: { feedback: null, isCorrect: true },
          stepId: "s1",
        },
      },
      selectedAnswers: { s1: mcAnswer },
      steps,
    });

    const next = playerReducer(state, { type: "RESTART" });
    expect(next.phase).toBe("playing");
    expect(next.currentStepIndex).toBe(0);
  });

  test("clears results, selectedAnswers, and dimensions", () => {
    const steps = [buildStep({ id: "s1", kind: "multipleChoice" })];
    const state = buildState({
      dimensions: { Quality: 2 },
      phase: "completed",
      results: {
        s1: {
          answer: mcAnswer,
          effects: [{ dimension: "Quality", impact: "positive" }],
          result: { feedback: null, isCorrect: true },
          stepId: "s1",
        },
      },
      selectedAnswers: { s1: mcAnswer },
      steps,
    });

    const next = playerReducer(state, { type: "RESTART" });
    expect(next.results).toEqual({});
    expect(next.selectedAnswers).toEqual({});
    expect(next.dimensions).toEqual({});
  });

  test("preserves activityId and steps", () => {
    const steps = [buildStep({ id: "s1" }), buildStep({ id: "s2", position: 1 })];
    const state = buildState({
      activityId: "my-activity",
      phase: "completed",
      steps,
    });

    const next = playerReducer(state, { type: "RESTART" });
    expect(next.activityId).toBe("my-activity");
    expect(next.steps).toEqual(steps);
  });
});

describe("edge cases", () => {
  test("unknown action returns state unchanged", () => {
    const state = buildState();
    const next = playerReducer(state, { type: "UNKNOWN" } as any as PlayerAction);
    expect(next).toBe(state);
  });

  test("empty steps array", () => {
    const activity = buildActivity({ steps: [] });
    const state = createInitialState(activity);
    expect(state.steps).toEqual([]);
    expect(state.currentStepIndex).toBe(0);
  });

  test("CHECK_ANSWER with multiple effects on different dimensions", () => {
    const state = buildState();
    const next = playerReducer(state, {
      effects: [
        { dimension: "Quality", impact: "positive" },
        { dimension: "Speed", impact: "negative" },
        { dimension: "Budget", impact: "neutral" },
      ],
      result: { feedback: null, isCorrect: true },
      stepId: "step-1",
      type: "CHECK_ANSWER",
    });
    expect(next.dimensions).toEqual({ Budget: 0, Quality: 1, Speed: -1 });
  });

  test("results include the stored StepResult structure", () => {
    const step = buildStep({ id: "mc-1", kind: "multipleChoice" });
    const answer: SelectedAnswer = { kind: "multipleChoice", selectedIndex: 2 };
    const state = buildState({ selectedAnswers: { "mc-1": answer }, steps: [step] });
    const next = playerReducer(state, {
      effects: [{ dimension: "Quality", impact: "positive" }],
      result: { feedback: "Good!", isCorrect: true },
      stepId: "mc-1",
      type: "CHECK_ANSWER",
    });
    const expected: StepResult = {
      answer,
      effects: [{ dimension: "Quality", impact: "positive" }],
      result: { feedback: "Good!", isCorrect: true },
      stepId: "mc-1",
    };
    expect(next.results["mc-1"]).toEqual(expected);
  });
});
