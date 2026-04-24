import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { describe, expect, test } from "vitest";
import { computeLocalCompletion } from "./player-completion";
import { type PlayerState, type SelectedAnswer, type StepResult } from "./player-reducer";

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
    activityKind: "quiz",
    completion: null,
    currentStepIndex: 0,
    investigationLoop: null,
    phase: "completed",
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

const storyStepContent = {
  choices: [
    {
      alignment: "strong" as const,
      consequence: "Things improve.",
      id: "1a",
      metricEffects: [{ effect: "positive" as const, metric: "Production" }],
      stateImage: { prompt: "State after the strong choice" },
      text: "Strong choice",
    },
    {
      alignment: "partial" as const,
      consequence: "Mixed results.",
      id: "1b",
      metricEffects: [{ effect: "neutral" as const, metric: "Production" }],
      stateImage: { prompt: "State after the partial choice" },
      text: "Partial choice",
    },
    {
      alignment: "weak" as const,
      consequence: "Things get worse.",
      id: "1c",
      metricEffects: [{ effect: "negative" as const, metric: "Production" }],
      stateImage: { prompt: "State after the weak choice" },
      text: "Weak choice",
    },
  ],
  problem: "You face a decision.",
};

function buildStoryStep(id: string, position: number): SerializedStep {
  return buildStep({ content: storyStepContent, id, kind: "story", position });
}

function buildStoryAnswer(selectedChoiceId: string): SelectedAnswer {
  return { kind: "story", selectedChoiceId, selectedText: "choice" };
}

function buildStoryResult(stepId: string, selectedChoiceId: string): StepResult {
  return {
    answer: buildStoryAnswer(selectedChoiceId),
    result: { correctAnswer: null, feedback: null, isCorrect: selectedChoiceId !== "1c" },
    stepId,
  };
}

describe(computeLocalCompletion, () => {
  describe("standard activities", () => {
    test("uses standard scoring for non-story steps", () => {
      const steps = [
        buildStep({
          content: {
            kind: "core" as const,
            options: [{ feedback: "Yes", isCorrect: true, text: "A" }],
          },
          id: "mc-1",
          kind: "multipleChoice",
        }),
      ];

      const results: Record<string, StepResult> = {
        "mc-1": {
          answer: { kind: "multipleChoice", selectedIndex: 0, selectedText: "A" },
          result: { correctAnswer: null, feedback: "Yes", isCorrect: true },
          stepId: "mc-1",
        },
      };

      const completion = computeLocalCompletion(buildState({ results, steps }));
      expect(completion.brainPower).toBe(10);
      expect(completion.correctCount).toBe(1);
      expect(completion.incorrectCount).toBe(0);
    });
  });

  describe("story activities", () => {
    test("uses story scoring with 100 BP", () => {
      const steps = [buildStoryStep("s1", 0), buildStoryStep("s2", 1)];
      const results: Record<string, StepResult> = {
        s1: buildStoryResult("s1", "1a"),
        s2: buildStoryResult("s2", "1a"),
      };
      const selectedAnswers: Record<string, SelectedAnswer> = {
        s1: buildStoryAnswer("1a"),
        s2: buildStoryAnswer("1a"),
      };

      const completion = computeLocalCompletion(
        buildState({ activityKind: "story", results, selectedAnswers, steps }),
      );

      expect(completion.brainPower).toBe(100);
    });

    test("computes energy from alignments: all strong = 6 for 2 steps", () => {
      const steps = [buildStoryStep("s1", 0), buildStoryStep("s2", 1)];
      const results: Record<string, StepResult> = {
        s1: buildStoryResult("s1", "1a"),
        s2: buildStoryResult("s2", "1a"),
      };
      const selectedAnswers: Record<string, SelectedAnswer> = {
        s1: buildStoryAnswer("1a"),
        s2: buildStoryAnswer("1a"),
      };

      const completion = computeLocalCompletion(
        buildState({ activityKind: "story", results, selectedAnswers, steps }),
      );

      expect(completion.energyDelta).toBe(6);
    });

    test("computes energy from mixed alignments", () => {
      const steps = [buildStoryStep("s1", 0), buildStoryStep("s2", 1), buildStoryStep("s3", 2)];
      const results: Record<string, StepResult> = {
        s1: buildStoryResult("s1", "1a"), // strong = 3
        s2: buildStoryResult("s2", "1b"), // partial = 1
        s3: buildStoryResult("s3", "1c"), // weak = 0
      };
      const selectedAnswers: Record<string, SelectedAnswer> = {
        s1: buildStoryAnswer("1a"),
        s2: buildStoryAnswer("1b"),
        s3: buildStoryAnswer("1c"),
      };

      const completion = computeLocalCompletion(
        buildState({ activityKind: "story", results, selectedAnswers, steps }),
      );

      expect(completion.energyDelta).toBe(4);
    });

    test("skips steps without answers", () => {
      const steps = [buildStoryStep("s1", 0), buildStoryStep("s2", 1)];
      const results: Record<string, StepResult> = {
        s1: buildStoryResult("s1", "1a"), // strong = 3
      };
      const selectedAnswers: Record<string, SelectedAnswer> = {
        s1: buildStoryAnswer("1a"),
      };

      const completion = computeLocalCompletion(
        buildState({ activityKind: "story", results, selectedAnswers, steps }),
      );

      expect(completion.energyDelta).toBe(3);
    });

    test("detects story activity when story steps are preceded by static intro", () => {
      const steps = [
        buildStep({
          content: {
            text: "You are a manager.",
            title: "Factory crisis",
            variant: "intro" as const,
          },
          id: "intro",
          kind: "static",
          position: 0,
        }),
        buildStoryStep("s1", 1),
        buildStoryStep("s2", 2),
      ];

      const results: Record<string, StepResult> = {
        s1: buildStoryResult("s1", "1a"),
        s2: buildStoryResult("s2", "1b"),
      };
      const selectedAnswers: Record<string, SelectedAnswer> = {
        s1: buildStoryAnswer("1a"),
        s2: buildStoryAnswer("1b"),
      };

      const completion = computeLocalCompletion(
        buildState({ activityKind: "story", results, selectedAnswers, steps }),
      );

      expect(completion.brainPower).toBe(100);
    });

    test("adds story BP to existing totalBrainPower", () => {
      const steps = [buildStoryStep("s1", 0)];
      const results: Record<string, StepResult> = {
        s1: buildStoryResult("s1", "1a"),
      };
      const selectedAnswers: Record<string, SelectedAnswer> = {
        s1: buildStoryAnswer("1a"),
      };

      const completion = computeLocalCompletion(
        buildState({
          activityKind: "story",
          results,
          selectedAnswers,
          steps,
          totalBrainPower: 500,
        }),
      );

      expect(completion.newTotalBp).toBe(600);
    });

    test("counts correct and incorrect for story alignments", () => {
      const steps = [buildStoryStep("s1", 0), buildStoryStep("s2", 1), buildStoryStep("s3", 2)];
      const results: Record<string, StepResult> = {
        s1: buildStoryResult("s1", "1a"), // strong = correct
        s2: buildStoryResult("s2", "1b"), // partial = correct
        s3: buildStoryResult("s3", "1c"), // weak = incorrect
      };
      const selectedAnswers: Record<string, SelectedAnswer> = {
        s1: buildStoryAnswer("1a"),
        s2: buildStoryAnswer("1b"),
        s3: buildStoryAnswer("1c"),
      };

      const completion = computeLocalCompletion(
        buildState({ activityKind: "story", results, selectedAnswers, steps }),
      );

      expect(completion.correctCount).toBe(2);
      expect(completion.incorrectCount).toBe(1);
    });
  });

  describe("investigation activities", () => {
    const actionContent = {
      actions: [
        {
          finding: "Critical evidence",
          id: "a1",
          label: "Check logs",
          quality: "critical" as const,
        },
        { finding: "Useful data", id: "a2", label: "Review metrics", quality: "useful" as const },
        { finding: "Nothing here", id: "a3", label: "Random check", quality: "weak" as const },
      ],
      variant: "action" as const,
    };

    const callContent = {
      explanations: [
        { accuracy: "best" as const, feedback: "Correct!", id: "e1", text: "Memory leak" },
        { accuracy: "wrong" as const, feedback: "Wrong.", id: "e2", text: "Network" },
      ],
      variant: "call" as const,
    };

    test("counts action qualities and call accuracy: 1 correct action + wrong call = 1/3", () => {
      const steps = [
        buildStep({ content: actionContent, id: "action-1", kind: "investigation" }),
        buildStep({ content: callContent, id: "call-1", kind: "investigation" }),
      ];

      const selectedAnswers: Record<string, SelectedAnswer> = {
        "call-1": { kind: "investigation", selectedExplanationId: "e2", variant: "call" },
      };

      const investigationLoop = {
        actionTimings: [],
        usedActionIds: ["a1", "a3"], // critical, weak
      };

      const completion = computeLocalCompletion(
        buildState({
          activityKind: "investigation",
          investigationLoop,
          results: {},
          selectedAnswers,
          steps,
        }),
      );

      expect(completion.correctCount).toBe(1);
      expect(completion.incorrectCount).toBe(2);
      expect(completion.brainPower).toBe(100);
    });

    test("perfect investigation: 2 correct actions + best call = 3/3", () => {
      const steps = [
        buildStep({ content: actionContent, id: "action-1", kind: "investigation" }),
        buildStep({ content: callContent, id: "call-1", kind: "investigation" }),
      ];

      const selectedAnswers: Record<string, SelectedAnswer> = {
        "call-1": { kind: "investigation", selectedExplanationId: "e1", variant: "call" },
      };

      const investigationLoop = {
        actionTimings: [],
        usedActionIds: ["a1", "a2"], // critical, useful — all correct
      };

      const completion = computeLocalCompletion(
        buildState({
          activityKind: "investigation",
          investigationLoop,
          results: {},
          selectedAnswers,
          steps,
        }),
      );

      expect(completion.correctCount).toBe(3);
      expect(completion.incorrectCount).toBe(0);
    });
  });
});
