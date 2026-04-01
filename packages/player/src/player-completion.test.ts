import { describe, expect, test } from "vitest";
import { computeLocalCompletion } from "./player-completion";
import { type PlayerState, type StepResult } from "./player-reducer";
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
      text: "Strong choice",
    },
    {
      alignment: "partial" as const,
      consequence: "Mixed results.",
      id: "1b",
      metricEffects: [{ effect: "neutral" as const, metric: "Production" }],
      text: "Partial choice",
    },
    {
      alignment: "weak" as const,
      consequence: "Things get worse.",
      id: "1c",
      metricEffects: [{ effect: "negative" as const, metric: "Production" }],
      text: "Weak choice",
    },
  ],
  situation: "You face a decision.",
};

function buildStoryStep(id: string, position: number): SerializedStep {
  return buildStep({ content: storyStepContent, id, kind: "story", position });
}

function buildStoryResult(stepId: string, selectedChoiceId: string): StepResult {
  return {
    answer: { kind: "story", selectedChoiceId, selectedText: "choice" },
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
    });
  });

  describe("story activities", () => {
    test("uses story scoring with 100 BP", () => {
      const steps = [buildStoryStep("s1", 0), buildStoryStep("s2", 1)];
      const results: Record<string, StepResult> = {
        s1: buildStoryResult("s1", "1a"),
        s2: buildStoryResult("s2", "1a"),
      };

      const completion = computeLocalCompletion(buildState({ results, steps }));
      expect(completion.brainPower).toBe(100);
    });

    test("computes energy from alignments: all strong = 6 for 2 steps", () => {
      const steps = [buildStoryStep("s1", 0), buildStoryStep("s2", 1)];
      const results: Record<string, StepResult> = {
        s1: buildStoryResult("s1", "1a"),
        s2: buildStoryResult("s2", "1a"),
      };

      const completion = computeLocalCompletion(buildState({ results, steps }));
      expect(completion.energyDelta).toBe(6);
    });

    test("computes energy from mixed alignments", () => {
      const steps = [buildStoryStep("s1", 0), buildStoryStep("s2", 1), buildStoryStep("s3", 2)];
      const results: Record<string, StepResult> = {
        s1: buildStoryResult("s1", "1a"), // strong = 3
        s2: buildStoryResult("s2", "1b"), // partial = 1
        s3: buildStoryResult("s3", "1c"), // weak = 0
      };

      const completion = computeLocalCompletion(buildState({ results, steps }));
      expect(completion.energyDelta).toBe(4);
    });

    test("skips steps without results", () => {
      const steps = [buildStoryStep("s1", 0), buildStoryStep("s2", 1)];
      const results: Record<string, StepResult> = {
        s1: buildStoryResult("s1", "1a"), // strong = 3
      };

      const completion = computeLocalCompletion(buildState({ results, steps }));
      expect(completion.energyDelta).toBe(3);
    });

    test("detects story activity when story steps are preceded by static intro", () => {
      const steps = [
        buildStep({
          content: {
            intro: "You are a manager.",
            metrics: ["Production", "Morale"],
            variant: "storyIntro" as const,
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

      const completion = computeLocalCompletion(buildState({ results, steps }));
      expect(completion.brainPower).toBe(100);
    });

    test("adds story BP to existing totalBrainPower", () => {
      const steps = [buildStoryStep("s1", 0)];
      const results: Record<string, StepResult> = {
        s1: buildStoryResult("s1", "1a"),
      };

      const completion = computeLocalCompletion(
        buildState({ results, steps, totalBrainPower: 500 }),
      );
      expect(completion.newTotalBp).toBe(600);
    });
  });
});
