import {
  type SerializedLesson,
  type SerializedStep,
} from "@zoonk/core/player/contracts/prepare-lesson-data";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type PlayerProgressSnapshot } from "./completion-milestones";
import {
  type PlayerState,
  type SelectedAnswer,
  type StepResult,
  createInitialState,
  playerReducer,
} from "./player-reducer";

const multipleChoiceContent = {
  options: [
    { feedback: "Yes", id: "option-a", isCorrect: true, text: "A" },
    { feedback: "No", id: "option-b", isCorrect: false, text: "B" },
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
  return buildStep({ content: multipleChoiceContent, kind: "multipleChoice", ...overrides });
}

function buildLesson(overrides: Partial<SerializedLesson> = {}): SerializedLesson {
  return {
    description: null,
    id: "lesson-1",
    kind: "quiz",
    language: "en",
    lessonSentences: [],
    lessonWords: [],
    organizationId: "org-1",
    steps: [buildStep()],
    title: "Test Lesson",
    ...overrides,
  };
}

function buildState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    completion: null,
    completionMilestoneIndex: null,
    currentStepIndex: 0,
    lessonId: "lesson-1",
    lessonKind: "quiz",
    localDate: "2026-06-05",
    phase: "playing",
    progressSnapshot: null,
    results: {},
    selectedAnswers: {},
    shownCompletionMilestoneKeys: [],
    startedAt: 1000,
    stepStartedAt: 1000,
    stepTimings: {},
    steps: [buildStep()],
    totalBrainPower: 0,
    ...overrides,
  };
}

function buildProgressSnapshot(
  overrides: Partial<PlayerProgressSnapshot> = {},
): PlayerProgressSnapshot {
  return {
    bestDayScores: [],
    currentEnergy: 0,
    fullEnergyDays: 0,
    highestPreviousDailyBrainPower: 0,
    learningDays: 0,
    todayBrainPower: 0,
    todayCompletedLessons: 0,
    todayEnergyAtEnd: null,
    todayInteractiveLessons: 0,
    totalLearningSeconds: 0,
    ...overrides,
  };
}

const multipleChoiceAnswer: SelectedAnswer = {
  kind: "multipleChoice",
  selectedOptionId: "option-a",
};

describe(createInitialState, () => {
  it("sets phase to playing and index to 0", () => {
    const lesson = buildLesson();
    const state = createInitialState({ lesson, totalBrainPower: 0 });
    expect(state.phase).toBe("playing");
    expect(state.currentStepIndex).toBe(0);
  });

  it("starts in the warning phase when the host requires start confirmation", () => {
    const lesson = buildLesson();

    const state = createInitialState({
      lesson,
      requiresStartConfirmation: true,
      totalBrainPower: 0,
    });

    expect(state.phase).toBe("startWarning");
    expect(state.currentStepIndex).toBe(0);
  });

  it("does not show the warning phase for empty lessons", () => {
    const lesson = buildLesson({ steps: [] });

    const state = createInitialState({
      lesson,
      requiresStartConfirmation: true,
      totalBrainPower: 0,
    });

    expect(state.phase).toBe("completed");
  });

  it("copies lessonId and steps", () => {
    const steps = [buildStep({ id: "s1" }), buildStep({ id: "s2", position: 1 })];
    const lesson = buildLesson({ steps });
    const state = createInitialState({ lesson, totalBrainPower: 0 });
    expect(state.lessonId).toBe("lesson-1");
    expect(state.steps).toStrictEqual(steps);
  });

  it("initializes empty maps", () => {
    const state = createInitialState({ lesson: buildLesson(), totalBrainPower: 0 });
    expect(state.selectedAnswers).toStrictEqual({});
    expect(state.results).toStrictEqual({});
  });

  it("stores totalBrainPower from input", () => {
    const state = createInitialState({ lesson: buildLesson(), totalBrainPower: 500 });
    expect(state.totalBrainPower).toBe(500);
  });

  it("stores the progress snapshot from input", () => {
    const progressSnapshot = buildProgressSnapshot({
      currentEnergy: 20,
      fullEnergyDays: 30,
      highestPreviousDailyBrainPower: 40,
      todayBrainPower: 10,
      todayEnergyAtEnd: 20,
    });

    const state = createInitialState({
      lesson: buildLesson(),
      progressSnapshot,
      totalBrainPower: 0,
    });

    expect(state.progressSnapshot).toStrictEqual(progressSnapshot);
  });

  it("pre-populates selectedAnswers for sortOrder steps", () => {
    const sortItems = ["Banana", "Apple", "Cherry"];
    const steps = [buildStep({ id: "sort-1", kind: "sortOrder", sortOrderItems: sortItems })];
    const state = createInitialState({ lesson: buildLesson({ steps }), totalBrainPower: 0 });

    expect(state.selectedAnswers["sort-1"]).toStrictEqual({
      kind: "sortOrder",
      userOrder: sortItems,
    });
  });

  it("does not pre-populate selectedAnswers for non-sortOrder steps", () => {
    const steps = [
      buildStep({ id: "s1", kind: "static" }),
      buildMultipleChoiceStep({ id: "mc-1" }),
    ];

    const state = createInitialState({ lesson: buildLesson({ steps }), totalBrainPower: 0 });
    expect(state.selectedAnswers).toStrictEqual({});
  });
});

describe("SELECT_ANSWER", () => {
  it("stores answer by stepId", () => {
    const state = buildState();

    const next = playerReducer(state, {
      answer: multipleChoiceAnswer,
      stepId: "step-1",
      type: "SELECT_ANSWER",
    });

    expect(next.selectedAnswers["step-1"]).toStrictEqual(multipleChoiceAnswer);
  });

  it("does not change phase or index", () => {
    const state = buildState();

    const next = playerReducer(state, {
      answer: multipleChoiceAnswer,
      stepId: "step-1",
      type: "SELECT_ANSWER",
    });

    expect(next.phase).toBe("playing");
    expect(next.currentStepIndex).toBe(0);
  });

  it("overwrites previous answer for same step", () => {
    const state = buildState({
      selectedAnswers: { "step-1": { kind: "multipleChoice", selectedOptionId: "option-b" } },
    });

    const next = playerReducer(state, {
      answer: multipleChoiceAnswer,
      stepId: "step-1",
      type: "SELECT_ANSWER",
    });

    expect(next.selectedAnswers["step-1"]).toStrictEqual(multipleChoiceAnswer);
  });
});

describe("START", () => {
  it("begins a lesson from the warning phase and resets the lesson timers", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T12:00:10Z"));

    try {
      const state = buildState({ phase: "startWarning", startedAt: 1000, stepStartedAt: 1000 });

      const next = playerReducer(state, { type: "START" });

      expect(next.phase).toBe("playing");
      expect(next.startedAt).toBe(Date.now());
      expect(next.stepStartedAt).toBe(Date.now());
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not restart an already playing lesson", () => {
    const state = buildState({ phase: "playing", startedAt: 1000, stepStartedAt: 1000 });

    const next = playerReducer(state, { type: "START" });

    expect(next).toBe(state);
  });
});

describe("CHECK_ANSWER", () => {
  it("transitions from playing to feedback and stores result", () => {
    const step = buildMultipleChoiceStep({ id: "mc-1" });
    const state = buildState({ steps: [step] });

    const next = playerReducer(state, {
      result: { correctAnswer: null, feedback: "Correct!", isCorrect: true },
      stepId: "mc-1",
      type: "CHECK_ANSWER",
    });

    expect(next.phase).toBe("feedback");

    expect(next.results["mc-1"]).toStrictEqual({
      answer: undefined,
      result: { correctAnswer: null, feedback: "Correct!", isCorrect: true },
      stepId: "mc-1",
    });
  });

  it("includes selected answer in the result", () => {
    const step = buildMultipleChoiceStep({ id: "mc-1" });
    const state = buildState({ selectedAnswers: { "mc-1": multipleChoiceAnswer }, steps: [step] });

    const next = playerReducer(state, {
      result: { correctAnswer: null, feedback: "Correct!", isCorrect: true },
      stepId: "mc-1",
      type: "CHECK_ANSWER",
    });

    expect(next.results["mc-1"]?.answer).toStrictEqual(multipleChoiceAnswer);
  });

  describe("matchColumns auto-advance", () => {
    it("auto-advances to next step instead of entering feedback phase", () => {
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

      expect(next.results["mc-1"]).toStrictEqual({
        answer: undefined,
        result: { correctAnswer: null, feedback: null, isCorrect: true },
        stepId: "mc-1",
      });
    });

    it("sets completed when matchColumns is the last step", () => {
      const steps = [buildStep({ id: "mc-1", kind: "matchColumns", position: 0 })];
      const state = buildState({ steps });

      const next = playerReducer(state, {
        result: { correctAnswer: null, feedback: null, isCorrect: true },
        stepId: "mc-1",
        type: "CHECK_ANSWER",
      });

      expect(next.phase).toBe("completed");

      expect(next.results["mc-1"]).toStrictEqual({
        answer: undefined,
        result: { correctAnswer: null, feedback: null, isCorrect: true },
        stepId: "mc-1",
      });
    });

    it("records stepTimings on last matchColumns step", () => {
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

      expect(next.stepTimings["mc-1"]).toStrictEqual({
        answeredAt: Date.now(),
        dayOfWeek: 0,
        durationSeconds: 7,
        hourOfDay: 14,
      });

      vi.useRealTimers();
    });
  });

  it("no-ops in feedback phase", () => {
    const state = buildState({ phase: "feedback" });

    const next = playerReducer(state, {
      result: { correctAnswer: null, feedback: null, isCorrect: true },
      stepId: "step-1",
      type: "CHECK_ANSWER",
    });

    expect(next).toBe(state);
  });

  it("no-ops in completed phase", () => {
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
  it("advances from feedback to playing on next step", () => {
    const steps = [buildStep({ id: "s1" }), buildStep({ id: "s2", position: 1 })];
    const state = buildState({ currentStepIndex: 0, phase: "feedback", steps });
    const next = playerReducer(state, { type: "CONTINUE" });
    expect(next.phase).toBe("playing");
    expect(next.currentStepIndex).toBe(1);
  });

  it("sets completed when on last step", () => {
    const state = buildState({ currentStepIndex: 0, phase: "feedback", steps: [buildStep()] });
    const next = playerReducer(state, { type: "CONTINUE" });
    expect(next.phase).toBe("completed");
  });

  it("no-ops in playing phase", () => {
    const state = buildState({ phase: "playing" });
    const next = playerReducer(state, { type: "CONTINUE" });
    expect(next).toBe(state);
  });

  it("no-ops in completed phase", () => {
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

  it("next advances on static step", () => {
    const state = buildState({ currentStepIndex: 0, steps: staticSteps });
    const next = playerReducer(state, { direction: "next", type: "NAVIGATE_STEP" });
    expect(next.currentStepIndex).toBe(1);
    expect(next.phase).toBe("playing");
  });

  it("prev goes back on static step", () => {
    const state = buildState({ currentStepIndex: 1, steps: staticSteps });
    const next = playerReducer(state, { direction: "prev", type: "NAVIGATE_STEP" });
    expect(next.currentStepIndex).toBe(0);
  });

  it("prev clamps at 0", () => {
    const state = buildState({ currentStepIndex: 0, steps: staticSteps });
    const next = playerReducer(state, { direction: "prev", type: "NAVIGATE_STEP" });
    expect(next.currentStepIndex).toBe(0);
  });

  it("next past last step transitions to completed", () => {
    const state = buildState({ currentStepIndex: 2, steps: staticSteps });
    const next = playerReducer(state, { direction: "next", type: "NAVIGATE_STEP" });
    expect(next.phase).toBe("completed");
  });

  it("prev from last step goes back", () => {
    const state = buildState({ currentStepIndex: 2, steps: staticSteps });
    const next = playerReducer(state, { direction: "prev", type: "NAVIGATE_STEP" });
    expect(next.currentStepIndex).toBe(1);
    expect(next.phase).toBe("playing");
  });

  it("prev no-ops when previous step is interactive", () => {
    const steps = [
      buildMultipleChoiceStep({ id: "mc-1", position: 0 }),
      buildStep({ id: "s1", kind: "static", position: 1 }),
    ];

    const state = buildState({ currentStepIndex: 1, steps });
    const next = playerReducer(state, { direction: "prev", type: "NAVIGATE_STEP" });
    expect(next).toBe(state);
  });

  it("no-ops on interactive step", () => {
    const steps = [buildMultipleChoiceStep({ id: "mc-1" })];
    const state = buildState({ steps });
    const next = playerReducer(state, { direction: "next", type: "NAVIGATE_STEP" });
    expect(next).toBe(state);
  });

  it("no-ops in feedback phase", () => {
    const state = buildState({ phase: "feedback", steps: staticSteps });
    const next = playerReducer(state, { direction: "next", type: "NAVIGATE_STEP" });
    expect(next).toBe(state);
  });

  it("no-ops in completed phase", () => {
    const state = buildState({ phase: "completed", steps: staticSteps });
    const next = playerReducer(state, { direction: "next", type: "NAVIGATE_STEP" });
    expect(next).toBe(state);
  });
});

describe("COMPLETE", () => {
  it("sets completed from playing", () => {
    const state = buildState({ phase: "playing" });
    const next = playerReducer(state, { type: "COMPLETE" });
    expect(next.phase).toBe("completed");
  });

  it("sets completed from feedback", () => {
    const state = buildState({ phase: "feedback" });
    const next = playerReducer(state, { type: "COMPLETE" });
    expect(next.phase).toBe("completed");
  });

  it("no-ops when already completed", () => {
    const state = buildState({ phase: "completed" });
    const next = playerReducer(state, { type: "COMPLETE" });
    expect(next).toBe(state);
  });
});

describe("local completion computation", () => {
  it("computes completion result when CONTINUE transitions to completed", () => {
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
    expect(next.completionMilestoneIndex).toBeNull();
  });

  it("computes completion result when NAVIGATE_STEP passes last step", () => {
    const steps = [buildStep({ id: "s1", kind: "static" })];
    const state = buildState({ currentStepIndex: 0, steps, totalBrainPower: 50 });

    const next = playerReducer(state, { direction: "next", type: "NAVIGATE_STEP" });

    expect(next.phase).toBe("completed");
    expect(next.completion).not.toBeNull();
    expect(next.completion?.brainPower).toBe(10);
    expect(next.completion?.newTotalBp).toBe(60);
    expect(next.completionMilestoneIndex).toBeNull();
  });

  it("activates a completion milestone when completion reaches a new level", () => {
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
      totalBrainPower: 240,
    });

    const next = playerReducer(state, { type: "CONTINUE" });

    expect(next.phase).toBe("completed");
    expect(next.completionMilestoneIndex).toBe(0);
  });

  it("uses CONTINUE to move from a completion milestone to the summary", () => {
    const state = buildState({
      completion: {
        belt: {
          bpPerLevel: 250,
          bpToNextLevel: 250,
          color: "white",
          isMaxLevel: false,
          level: 2,
          progressInLevel: 0,
        },
        brainPower: 10,
        correctCount: 1,
        energyDelta: 0.2,
        incorrectCount: 0,
        newTotalBp: 250,
      },
      completionMilestoneIndex: 0,
      phase: "completed",
      totalBrainPower: 240,
    });

    const next = playerReducer(state, { type: "CONTINUE" });

    expect(next.completionMilestoneIndex).toBeNull();
  });

  it("uses CONTINUE to move through multiple completion milestones before the summary", () => {
    const state = buildState({
      completion: {
        belt: {
          bpPerLevel: 250,
          bpToNextLevel: 250,
          color: "white",
          isMaxLevel: false,
          level: 2,
          progressInLevel: 0,
        },
        brainPower: 10,
        correctCount: 1,
        energyDelta: 0.2,
        incorrectCount: 0,
        newTotalBp: 250,
      },
      completionMilestoneIndex: 0,
      phase: "completed",
      progressSnapshot: buildProgressSnapshot({
        currentEnergy: 9.9,
        highestPreviousDailyBrainPower: 100,
      }),
      totalBrainPower: 240,
    });

    const energyMilestoneState = playerReducer(state, { type: "CONTINUE" });
    const summaryState = playerReducer(energyMilestoneState, { type: "CONTINUE" });

    expect(energyMilestoneState.completionMilestoneIndex).toBe(1);
    expect(summaryState.completionMilestoneIndex).toBeNull();
  });

  it("resets completion to null on RESTART", () => {
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
        correctCount: 1,
        energyDelta: 0.2,
        incorrectCount: 0,
        newTotalBp: 10,
      },
      completionMilestoneIndex: 0,
      phase: "completed",
    });

    const next = playerReducer(state, { type: "RESTART" });

    expect(next.completion).toBeNull();
    expect(next.completionMilestoneIndex).toBeNull();
  });
});

describe("RESTART", () => {
  it("resets to playing with index 0 from completed state", () => {
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

  it("clears results and selectedAnswers", () => {
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
    expect(next.results).toStrictEqual({});
    expect(next.selectedAnswers).toStrictEqual({});
  });

  it("preserves lessonId and steps", () => {
    const steps = [buildStep({ id: "s1" }), buildStep({ id: "s2", position: 1 })];
    const state = buildState({ lessonId: "my-lesson", phase: "completed", steps });

    const next = playerReducer(state, { type: "RESTART" });
    expect(next.lessonId).toBe("my-lesson");
    expect(next.steps).toStrictEqual(steps);
  });

  it("re-seeds sortOrder answers on restart", () => {
    const sortItems = ["Banana", "Apple", "Cherry"];

    const steps = [
      buildStep({ id: "sort-1", kind: "sortOrder", sortOrderItems: sortItems }),
      buildMultipleChoiceStep({ id: "mc-1", position: 1 }),
    ];

    const state = buildState({ phase: "completed", results: {}, selectedAnswers: {}, steps });

    const next = playerReducer(state, { type: "RESTART" });

    expect(next.selectedAnswers["sort-1"]).toStrictEqual({
      kind: "sortOrder",
      userOrder: sortItems,
    });

    expect(next.selectedAnswers["mc-1"]).toBeUndefined();
  });
});

describe("CLEAR_ANSWER", () => {
  it("removes the selected answer for the given stepId", () => {
    const state = buildState({
      selectedAnswers: {
        "step-1": multipleChoiceAnswer,
        "step-2": { kind: "fillBlank", userAnswers: ["cat", "mat"] },
      },
    });

    const next = playerReducer(state, { stepId: "step-1", type: "CLEAR_ANSWER" });

    expect(next.selectedAnswers).toStrictEqual({
      "step-2": { kind: "fillBlank", userAnswers: ["cat", "mat"] },
    });
  });

  it("no-ops when stepId is not in selectedAnswers", () => {
    const state = buildState({ selectedAnswers: { "step-1": multipleChoiceAnswer } });
    const next = playerReducer(state, { stepId: "step-99", type: "CLEAR_ANSWER" });
    expect(next.selectedAnswers).toStrictEqual({ "step-1": multipleChoiceAnswer });
  });

  it("does not change phase or index", () => {
    const state = buildState({ selectedAnswers: { "step-1": multipleChoiceAnswer } });
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

  it("createInitialState sets startedAt and stepStartedAt", () => {
    vi.setSystemTime(new Date("2026-03-15T10:00:00"));
    const state = createInitialState({ lesson: buildLesson(), totalBrainPower: 0 });
    expect(state.startedAt).toBe(Date.now());
    expect(state.stepStartedAt).toBe(Date.now());
    expect(state.stepTimings).toStrictEqual({});
  });

  it("CHECK_ANSWER records step timing with duration, hourOfDay, dayOfWeek", () => {
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

    expect(next.stepTimings["mc-1"]).toStrictEqual({
      answeredAt: Date.now(),
      dayOfWeek: 0, // Sunday
      durationSeconds: 5,
      hourOfDay: 14,
    });
  });

  it("CONTINUE resets stepStartedAt when advancing to next step", () => {
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

  it("CONTINUE does not reset stepStartedAt on last step (completed)", () => {
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

  it("NAVIGATE_STEP next resets stepStartedAt", () => {
    vi.setSystemTime(new Date("2026-03-15T10:00:00"));

    const staticSteps = [
      buildStep({ id: "s1", kind: "static", position: 0 }),
      buildStep({ id: "s2", kind: "static", position: 1 }),
    ];

    const state = buildState({ stepStartedAt: 1000, steps: staticSteps });

    const next = playerReducer(state, { direction: "next", type: "NAVIGATE_STEP" });
    expect(next.stepStartedAt).toBe(Date.now());
  });

  it("NAVIGATE_STEP prev resets stepStartedAt", () => {
    vi.setSystemTime(new Date("2026-03-15T10:00:00"));

    const staticSteps = [
      buildStep({ id: "s1", kind: "static", position: 0 }),
      buildStep({ id: "s2", kind: "static", position: 1 }),
    ];

    const state = buildState({ currentStepIndex: 1, stepStartedAt: 1000, steps: staticSteps });

    const next = playerReducer(state, { direction: "prev", type: "NAVIGATE_STEP" });
    expect(next.stepStartedAt).toBe(Date.now());
  });

  it("RESTART resets startedAt, stepStartedAt, and clears stepTimings", () => {
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
    expect(next.stepTimings).toStrictEqual({});
  });
});

describe("edge cases", () => {
  it("unknown action returns state unchanged", () => {
    const state = buildState();
    const next = playerReducer(state, { type: "UNKNOWN" } as any);
    expect(next).toBe(state);
  });

  it("empty steps array sets phase to completed", () => {
    const lesson = buildLesson({ steps: [] });
    const state = createInitialState({ lesson, totalBrainPower: 0 });
    expect(state.steps).toStrictEqual([]);
    expect(state.currentStepIndex).toBe(0);
    expect(state.phase).toBe("completed");
  });

  it("results include the stored StepResult structure", () => {
    const step = buildMultipleChoiceStep({ id: "mc-1" });
    const answer: SelectedAnswer = { kind: "multipleChoice", selectedOptionId: "option-c" };
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

    expect(next.results["mc-1"]).toStrictEqual(expected);
  });
});
