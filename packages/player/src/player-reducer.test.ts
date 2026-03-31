import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  type PlayerState,
  type SelectedAnswer,
  type StepResult,
  createInitialState,
  playerReducer,
} from "./player-reducer";
import { type SerializedActivity, type SerializedStep } from "./prepare-activity-data";

const coreMultipleChoiceContent = {
  kind: "core" as const,
  options: [
    { feedback: "Yes", isCorrect: true, text: "A" },
    { feedback: "No", isCorrect: false, text: "B" },
  ],
};

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

function buildMultipleChoiceStep(overrides: Partial<SerializedStep> = {}): SerializedStep {
  return buildStep({ content: coreMultipleChoiceContent, kind: "multipleChoice", ...overrides });
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
    completion: null,
    currentStepIndex: 0,
    phase: "playing",
    results: {},
    selectedAnswers: {},
    startedAt: 1000,
    stepStartedAt: 1000,
    stepTimings: {},
    steps: [buildStep()],
    totalBrainPower: 0,
    ...overrides,
  };
}

const multipleChoiceAnswer: SelectedAnswer = {
  kind: "multipleChoice",
  selectedIndex: 0,
  selectedText: "Option A",
};

describe(createInitialState, () => {
  test("sets phase to playing and index to 0", () => {
    const activity = buildActivity();
    const state = createInitialState({ activity, totalBrainPower: 0 });
    expect(state.phase).toBe("playing");
    expect(state.currentStepIndex).toBe(0);
  });

  test("copies activityId and steps", () => {
    const steps = [buildStep({ id: "s1" }), buildStep({ id: "s2", position: 1 })];
    const activity = buildActivity({ steps });
    const state = createInitialState({ activity, totalBrainPower: 0 });
    expect(state.activityId).toBe("activity-1");
    expect(state.steps).toEqual(steps);
  });

  test("initializes empty maps", () => {
    const state = createInitialState({ activity: buildActivity(), totalBrainPower: 0 });
    expect(state.selectedAnswers).toEqual({});
    expect(state.results).toEqual({});
  });

  test("stores totalBrainPower from input", () => {
    const state = createInitialState({ activity: buildActivity(), totalBrainPower: 500 });
    expect(state.totalBrainPower).toBe(500);
  });

  test("pre-populates selectedAnswers for sortOrder steps", () => {
    const sortItems = ["Banana", "Apple", "Cherry"];
    const steps = [buildStep({ id: "sort-1", kind: "sortOrder", sortOrderItems: sortItems })];
    const state = createInitialState({ activity: buildActivity({ steps }), totalBrainPower: 0 });
    expect(state.selectedAnswers["sort-1"]).toEqual({
      kind: "sortOrder",
      userOrder: sortItems,
    });
  });

  test("does not pre-populate selectedAnswers for non-sortOrder steps", () => {
    const steps = [
      buildStep({ id: "s1", kind: "static" }),
      buildMultipleChoiceStep({ id: "mc-1" }),
    ];
    const state = createInitialState({ activity: buildActivity({ steps }), totalBrainPower: 0 });
    expect(state.selectedAnswers).toEqual({});
  });
});

describe("SELECT_ANSWER", () => {
  test("stores answer by stepId", () => {
    const state = buildState();
    const next = playerReducer(state, {
      answer: multipleChoiceAnswer,
      stepId: "step-1",
      type: "SELECT_ANSWER",
    });
    expect(next.selectedAnswers["step-1"]).toEqual(multipleChoiceAnswer);
  });

  test("does not change phase or index", () => {
    const state = buildState();
    const next = playerReducer(state, {
      answer: multipleChoiceAnswer,
      stepId: "step-1",
      type: "SELECT_ANSWER",
    });
    expect(next.phase).toBe("playing");
    expect(next.currentStepIndex).toBe(0);
  });

  test("overwrites previous answer for same step", () => {
    const state = buildState({
      selectedAnswers: {
        "step-1": { kind: "multipleChoice", selectedIndex: 1, selectedText: "Option B" },
      },
    });
    const next = playerReducer(state, {
      answer: multipleChoiceAnswer,
      stepId: "step-1",
      type: "SELECT_ANSWER",
    });
    expect(next.selectedAnswers["step-1"]).toEqual(multipleChoiceAnswer);
  });
});

describe("CHECK_ANSWER", () => {
  test("transitions from playing to feedback and stores result", () => {
    const step = buildMultipleChoiceStep({ id: "mc-1" });
    const state = buildState({ steps: [step] });
    const next = playerReducer(state, {
      result: { correctAnswer: null, feedback: "Correct!", isCorrect: true },
      stepId: "mc-1",
      type: "CHECK_ANSWER",
    });
    expect(next.phase).toBe("feedback");
    expect(next.results["mc-1"]).toEqual({
      answer: undefined,
      result: { correctAnswer: null, feedback: "Correct!", isCorrect: true },
      stepId: "mc-1",
    });
  });

  test("includes selected answer in the result", () => {
    const step = buildMultipleChoiceStep({ id: "mc-1" });
    const state = buildState({
      selectedAnswers: { "mc-1": multipleChoiceAnswer },
      steps: [step],
    });
    const next = playerReducer(state, {
      result: { correctAnswer: null, feedback: "Correct!", isCorrect: true },
      stepId: "mc-1",
      type: "CHECK_ANSWER",
    });
    expect(next.results["mc-1"]?.answer).toEqual(multipleChoiceAnswer);
  });

  describe("matchColumns auto-advance", () => {
    test("auto-advances to next step instead of entering feedback phase", () => {
      const steps = [
        buildStep({ id: "mc-1", kind: "matchColumns", position: 0 }),
        buildStep({ id: "mc-2", kind: "matchColumns", position: 1 }),
      ];
      const state = buildState({ steps });
      const next = playerReducer(state, {
        result: { correctAnswer: null, feedback: null, isCorrect: true },
        stepId: "mc-1",
        type: "CHECK_ANSWER",
      });
      expect(next.phase).toBe("playing");
      expect(next.currentStepIndex).toBe(1);
      expect(next.results["mc-1"]).toEqual({
        answer: undefined,
        result: { correctAnswer: null, feedback: null, isCorrect: true },
        stepId: "mc-1",
      });
    });

    test("sets completed when matchColumns is the last step", () => {
      const steps = [buildStep({ id: "mc-1", kind: "matchColumns", position: 0 })];
      const state = buildState({ steps });
      const next = playerReducer(state, {
        result: { correctAnswer: null, feedback: null, isCorrect: true },
        stepId: "mc-1",
        type: "CHECK_ANSWER",
      });
      expect(next.phase).toBe("completed");
      expect(next.results["mc-1"]).toEqual({
        answer: undefined,
        result: { correctAnswer: null, feedback: null, isCorrect: true },
        stepId: "mc-1",
      });
    });

    test("records stepTimings on last matchColumns step", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-15T14:30:00"));

      const startTime = Date.now();
      const steps = [buildStep({ id: "mc-1", kind: "matchColumns", position: 0 })];
      const state = buildState({ stepStartedAt: startTime, steps });

      vi.setSystemTime(new Date("2026-03-15T14:30:07"));

      const next = playerReducer(state, {
        result: { correctAnswer: null, feedback: null, isCorrect: true },
        stepId: "mc-1",
        type: "CHECK_ANSWER",
      });

      expect(next.phase).toBe("completed");
      expect(next.stepTimings["mc-1"]).toEqual({
        answeredAt: Date.now(),
        dayOfWeek: 0,
        durationSeconds: 7,
        hourOfDay: 14,
      });

      vi.useRealTimers();
    });
  });

  test("story step enters feedback phase instead of auto-continuing", () => {
    const storyContent = {
      choices: [
        {
          alignment: "strong" as const,
          consequence: "Things improve.",
          id: "1a",
          metricChanges: { production: 10 },
          text: "Do the right thing",
        },
        {
          alignment: "weak" as const,
          consequence: "Things get worse.",
          id: "1b",
          metricChanges: { production: -10 },
          text: "Do the wrong thing",
        },
      ],
      situation: "You face a decision.",
    };

    const steps = [
      buildStep({ content: storyContent, id: "story-1", kind: "story", position: 0 }),
      buildStep({ content: storyContent, id: "story-2", kind: "story", position: 1 }),
    ];

    const state = buildState({ steps });

    const next = playerReducer(state, {
      result: { correctAnswer: null, feedback: null, isCorrect: true },
      stepId: "story-1",
      type: "CHECK_ANSWER",
    });

    expect(next.phase).toBe("feedback");
    expect(next.currentStepIndex).toBe(0);
  });

  test("no-ops in feedback phase", () => {
    const state = buildState({ phase: "feedback" });
    const next = playerReducer(state, {
      result: { correctAnswer: null, feedback: null, isCorrect: true },
      stepId: "step-1",
      type: "CHECK_ANSWER",
    });
    expect(next).toBe(state);
  });

  test("no-ops in completed phase", () => {
    const state = buildState({ phase: "completed" });
    const next = playerReducer(state, {
      result: { correctAnswer: null, feedback: null, isCorrect: true },
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

  test("prev no-ops when previous step is interactive", () => {
    const steps = [
      buildMultipleChoiceStep({ id: "mc-1", position: 0 }),
      buildStep({ id: "s1", kind: "static", position: 1 }),
    ];
    const state = buildState({ currentStepIndex: 1, steps });
    const next = playerReducer(state, { direction: "prev", type: "NAVIGATE_STEP" });
    expect(next).toBe(state);
  });

  test("no-ops on interactive step", () => {
    const steps = [buildMultipleChoiceStep({ id: "mc-1" })];
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

describe("local completion computation", () => {
  test("computes completion result when CONTINUE transitions to completed", () => {
    const state = buildState({
      currentStepIndex: 0,
      phase: "feedback",
      results: {
        "step-1": {
          answer: multipleChoiceAnswer,
          result: { correctAnswer: null, feedback: "Yes", isCorrect: true },
          stepId: "step-1",
        },
      },
      steps: [buildMultipleChoiceStep()],
      totalBrainPower: 100,
    });

    const next = playerReducer(state, { type: "CONTINUE" });

    expect(next.phase).toBe("completed");
    expect(next.completion).not.toBeNull();
    expect(next.completion?.brainPower).toBe(10);
    expect(next.completion?.newTotalBp).toBe(110);
    expect(next.completion?.belt).toBeDefined();
  });

  test("computes completion result when NAVIGATE_STEP passes last step", () => {
    const steps = [buildStep({ id: "s1", kind: "static" })];
    const state = buildState({ currentStepIndex: 0, steps, totalBrainPower: 50 });

    const next = playerReducer(state, { direction: "next", type: "NAVIGATE_STEP" });

    expect(next.phase).toBe("completed");
    expect(next.completion).not.toBeNull();
    expect(next.completion?.brainPower).toBe(10);
    expect(next.completion?.newTotalBp).toBe(60);
  });

  test("resets completion to null on RESTART", () => {
    const state = buildState({
      completion: {
        belt: {
          bpPerLevel: 250,
          bpToNextLevel: 240,
          color: "white",
          isMaxLevel: false,
          level: 1,
          progressInLevel: 10,
        },
        brainPower: 10,
        energyDelta: 0.2,
        newTotalBp: 10,
      },
      phase: "completed",
    });

    const next = playerReducer(state, { type: "RESTART" });

    expect(next.completion).toBeNull();
  });
});

describe("RESTART", () => {
  test("resets to playing with index 0 from completed state", () => {
    const steps = [
      buildMultipleChoiceStep({ id: "s1" }),
      buildMultipleChoiceStep({ id: "s2", position: 1 }),
    ];
    const state = buildState({
      currentStepIndex: 1,
      phase: "completed",
      results: {
        s1: {
          answer: multipleChoiceAnswer,
          result: { correctAnswer: null, feedback: null, isCorrect: true },
          stepId: "s1",
        },
      },
      selectedAnswers: { s1: multipleChoiceAnswer },
      steps,
    });

    const next = playerReducer(state, { type: "RESTART" });
    expect(next.phase).toBe("playing");
    expect(next.currentStepIndex).toBe(0);
  });

  test("clears results and selectedAnswers", () => {
    const steps = [buildMultipleChoiceStep({ id: "s1" })];
    const state = buildState({
      phase: "completed",
      results: {
        s1: {
          answer: multipleChoiceAnswer,
          result: { correctAnswer: null, feedback: null, isCorrect: true },
          stepId: "s1",
        },
      },
      selectedAnswers: { s1: multipleChoiceAnswer },
      steps,
    });

    const next = playerReducer(state, { type: "RESTART" });
    expect(next.results).toEqual({});
    expect(next.selectedAnswers).toEqual({});
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

  test("re-seeds sortOrder answers on restart", () => {
    const sortItems = ["Banana", "Apple", "Cherry"];
    const steps = [
      buildStep({ id: "sort-1", kind: "sortOrder", sortOrderItems: sortItems }),
      buildMultipleChoiceStep({ id: "mc-1", position: 1 }),
    ];
    const state = buildState({
      phase: "completed",
      results: {},
      selectedAnswers: {},
      steps,
    });

    const next = playerReducer(state, { type: "RESTART" });
    expect(next.selectedAnswers["sort-1"]).toEqual({
      kind: "sortOrder",
      userOrder: sortItems,
    });
    expect(next.selectedAnswers["mc-1"]).toBeUndefined();
  });
});

describe("CLEAR_ANSWER", () => {
  test("removes the selected answer for the given stepId", () => {
    const state = buildState({
      selectedAnswers: {
        "step-1": multipleChoiceAnswer,
        "step-2": { kind: "fillBlank", userAnswers: ["cat", "mat"] },
      },
    });
    const next = playerReducer(state, { stepId: "step-1", type: "CLEAR_ANSWER" });
    expect(next.selectedAnswers).toEqual({
      "step-2": { kind: "fillBlank", userAnswers: ["cat", "mat"] },
    });
  });

  test("no-ops when stepId is not in selectedAnswers", () => {
    const state = buildState({
      selectedAnswers: { "step-1": multipleChoiceAnswer },
    });
    const next = playerReducer(state, { stepId: "step-99", type: "CLEAR_ANSWER" });
    expect(next.selectedAnswers).toEqual({ "step-1": multipleChoiceAnswer });
  });

  test("does not change phase or index", () => {
    const state = buildState({
      selectedAnswers: { "step-1": multipleChoiceAnswer },
    });
    const next = playerReducer(state, { stepId: "step-1", type: "CLEAR_ANSWER" });
    expect(next.phase).toBe("playing");
    expect(next.currentStepIndex).toBe(0);
  });
});

describe("timing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("createInitialState sets startedAt and stepStartedAt", () => {
    vi.setSystemTime(new Date("2026-03-15T10:00:00"));
    const state = createInitialState({ activity: buildActivity(), totalBrainPower: 0 });
    expect(state.startedAt).toBe(Date.now());
    expect(state.stepStartedAt).toBe(Date.now());
    expect(state.stepTimings).toEqual({});
  });

  test("CHECK_ANSWER records step timing with duration, hourOfDay, dayOfWeek", () => {
    vi.setSystemTime(new Date("2026-03-15T14:30:00"));
    const startTime = Date.now();
    const step = buildMultipleChoiceStep({ id: "mc-1" });
    const state = buildState({ stepStartedAt: startTime, steps: [step] });

    vi.setSystemTime(new Date("2026-03-15T14:30:05"));
    const next = playerReducer(state, {
      result: { correctAnswer: null, feedback: "Correct!", isCorrect: true },
      stepId: "mc-1",
      type: "CHECK_ANSWER",
    });

    expect(next.stepTimings["mc-1"]).toEqual({
      answeredAt: Date.now(),
      dayOfWeek: 0, // Sunday
      durationSeconds: 5,
      hourOfDay: 14,
    });
  });

  test("CONTINUE resets stepStartedAt when advancing to next step", () => {
    const steps = [buildStep({ id: "s1" }), buildStep({ id: "s2", position: 1 })];

    vi.setSystemTime(new Date("2026-03-15T10:00:00"));
    const state = buildState({
      currentStepIndex: 0,
      phase: "feedback",
      stepStartedAt: 1000,
      steps,
    });

    const next = playerReducer(state, { type: "CONTINUE" });
    expect(next.stepStartedAt).toBe(Date.now());
    expect(next.stepStartedAt).not.toBe(1000);
  });

  test("CONTINUE does not reset stepStartedAt on last step (completed)", () => {
    const state = buildState({
      currentStepIndex: 0,
      phase: "feedback",
      stepStartedAt: 1000,
      steps: [buildStep()],
    });

    const next = playerReducer(state, { type: "CONTINUE" });
    expect(next.phase).toBe("completed");
    expect(next.stepStartedAt).toBe(1000);
  });

  test("NAVIGATE_STEP next resets stepStartedAt", () => {
    vi.setSystemTime(new Date("2026-03-15T10:00:00"));
    const staticSteps = [
      buildStep({ id: "s1", kind: "static", position: 0 }),
      buildStep({ id: "s2", kind: "static", position: 1 }),
    ];
    const state = buildState({ stepStartedAt: 1000, steps: staticSteps });

    const next = playerReducer(state, { direction: "next", type: "NAVIGATE_STEP" });
    expect(next.stepStartedAt).toBe(Date.now());
  });

  test("NAVIGATE_STEP prev resets stepStartedAt", () => {
    vi.setSystemTime(new Date("2026-03-15T10:00:00"));
    const staticSteps = [
      buildStep({ id: "s1", kind: "static", position: 0 }),
      buildStep({ id: "s2", kind: "static", position: 1 }),
    ];
    const state = buildState({ currentStepIndex: 1, stepStartedAt: 1000, steps: staticSteps });

    const next = playerReducer(state, { direction: "prev", type: "NAVIGATE_STEP" });
    expect(next.stepStartedAt).toBe(Date.now());
  });

  test("RESTART resets startedAt, stepStartedAt, and clears stepTimings", () => {
    vi.setSystemTime(new Date("2026-03-15T10:00:00"));
    const state = buildState({
      phase: "completed",
      startedAt: 500,
      stepStartedAt: 800,
      stepTimings: {
        "step-1": { answeredAt: 900, dayOfWeek: 0, durationSeconds: 3, hourOfDay: 14 },
      },
    });

    const next = playerReducer(state, { type: "RESTART" });
    expect(next.startedAt).toBe(Date.now());
    expect(next.stepStartedAt).toBe(Date.now());
    expect(next.stepTimings).toEqual({});
  });
});

describe("edge cases", () => {
  test("unknown action returns state unchanged", () => {
    const state = buildState();
    const next = playerReducer(state, { type: "UNKNOWN" } as any);
    expect(next).toBe(state);
  });

  test("empty steps array sets phase to completed", () => {
    const activity = buildActivity({ steps: [] });
    const state = createInitialState({ activity, totalBrainPower: 0 });
    expect(state.steps).toEqual([]);
    expect(state.currentStepIndex).toBe(0);
    expect(state.phase).toBe("completed");
  });

  test("results include the stored StepResult structure", () => {
    const step = buildMultipleChoiceStep({ id: "mc-1" });
    const answer: SelectedAnswer = {
      kind: "multipleChoice",
      selectedIndex: 2,
      selectedText: "Option C",
    };
    const state = buildState({ selectedAnswers: { "mc-1": answer }, steps: [step] });
    const next = playerReducer(state, {
      result: { correctAnswer: null, feedback: "Good!", isCorrect: true },
      stepId: "mc-1",
      type: "CHECK_ANSWER",
    });
    const expected: StepResult = {
      answer,
      result: { correctAnswer: null, feedback: "Good!", isCorrect: true },
      stepId: "mc-1",
    };
    expect(next.results["mc-1"]).toEqual(expected);
  });
});
