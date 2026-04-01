import { describe, expect, test } from "vitest";
import { type PlayerState, type StepResult } from "./player-reducer";
import {
  getIsStoryActivity,
  getStoryMetrics,
  getStoryStaticVariant,
  getUpcomingImages,
} from "./player-selectors";
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

const storyStepContent = {
  choices: [
    {
      alignment: "strong" as const,
      consequence: "Things improve.",
      id: "c1",
      metricEffects: [{ effect: "positive" as const, metric: "Production" }],
      text: "Strong choice",
    },
    {
      alignment: "partial" as const,
      consequence: "Mixed results.",
      id: "c2",
      metricEffects: [{ effect: "neutral" as const, metric: "Production" }],
      text: "Partial choice",
    },
    {
      alignment: "weak" as const,
      consequence: "Things get worse.",
      id: "c3",
      metricEffects: [
        { effect: "negative" as const, metric: "Production" },
        { effect: "negative" as const, metric: "Morale" },
      ],
      text: "Weak choice",
    },
  ],
  situation: "You face a decision.",
};

function buildStoryStep(id: string, position: number): SerializedStep {
  return buildStep({ content: storyStepContent, id, kind: "story", position });
}

function buildStoryIntroStep(): SerializedStep {
  return buildStep({
    content: {
      intro: "You are a factory manager.",
      metrics: ["Production", "Morale"],
      variant: "storyIntro" as const,
    },
    id: "intro",
    kind: "static",
    position: 0,
  });
}

function buildStoryResult(stepId: string, selectedChoiceId: string): StepResult {
  return {
    answer: { kind: "story", selectedChoiceId, selectedText: "choice" },
    result: { correctAnswer: null, feedback: null, isCorrect: selectedChoiceId !== "c3" },
    stepId,
  };
}

describe(getIsStoryActivity, () => {
  test("returns true when activity has story steps", () => {
    const state = buildState({
      steps: [buildStoryIntroStep(), buildStoryStep("s1", 1)],
    });

    expect(getIsStoryActivity(state)).toBe(true);
  });

  test("returns false when activity has no story steps", () => {
    const state = buildState({
      steps: [buildStep({ id: "s1" }), buildStep({ id: "s2", position: 1 })],
    });

    expect(getIsStoryActivity(state)).toBe(false);
  });
});

describe(getStoryStaticVariant, () => {
  test("returns storyIntro when current step is a story intro", () => {
    const state = buildState({
      currentStepIndex: 0,
      steps: [buildStoryIntroStep(), buildStoryStep("s1", 1)],
    });

    expect(getStoryStaticVariant(state)).toBe("storyIntro");
  });

  test("returns storyOutcome when current step is a story outcome", () => {
    const state = buildState({
      currentStepIndex: 0,
      steps: [
        buildStep({
          content: {
            metrics: ["Production"],
            outcomes: [{ minStrongChoices: 0, narrative: "Result.", title: "Outcome" }],
            variant: "storyOutcome" as const,
          },
          id: "outcome",
          kind: "static",
        }),
      ],
    });

    expect(getStoryStaticVariant(state)).toBe("storyOutcome");
  });

  test("returns null when current step is a regular static step", () => {
    const state = buildState({
      steps: [buildStep({ content: { text: "Hello", title: "Intro", variant: "text" as const } })],
    });

    expect(getStoryStaticVariant(state)).toBeNull();
  });

  test("returns null when current step is a story decision step", () => {
    const state = buildState({
      steps: [buildStoryStep("s1", 0)],
    });

    expect(getStoryStaticVariant(state)).toBeNull();
  });
});

describe(getStoryMetrics, () => {
  test("returns initial values when no story steps are answered", () => {
    const state = buildState({
      steps: [buildStoryIntroStep(), buildStoryStep("s1", 1)],
    });

    expect(getStoryMetrics(state)).toEqual([
      { metric: "Production", value: 50 },
      { metric: "Morale", value: 50 },
    ]);
  });

  test("accumulates positive effects (+15)", () => {
    const state = buildState({
      results: { s1: buildStoryResult("s1", "c1") },
      steps: [buildStoryIntroStep(), buildStoryStep("s1", 1)],
    });

    expect(getStoryMetrics(state)).toEqual([
      { metric: "Production", value: 65 },
      { metric: "Morale", value: 50 },
    ]);
  });

  test("accumulates negative effects (-15)", () => {
    const state = buildState({
      results: { s1: buildStoryResult("s1", "c3") },
      steps: [buildStoryIntroStep(), buildStoryStep("s1", 1)],
    });

    expect(getStoryMetrics(state)).toEqual([
      { metric: "Production", value: 35 },
      { metric: "Morale", value: 35 },
    ]);
  });

  test("neutral effects leave value unchanged", () => {
    const state = buildState({
      results: { s1: buildStoryResult("s1", "c2") },
      steps: [buildStoryIntroStep(), buildStoryStep("s1", 1)],
    });

    expect(getStoryMetrics(state)).toEqual([
      { metric: "Production", value: 50 },
      { metric: "Morale", value: 50 },
    ]);
  });

  test("accumulates effects across multiple steps", () => {
    const state = buildState({
      results: {
        s1: buildStoryResult("s1", "c1"),
        s2: buildStoryResult("s2", "c3"),
      },
      steps: [buildStoryIntroStep(), buildStoryStep("s1", 1), buildStoryStep("s2", 2)],
    });

    // Production: 50 + 15 (c1) - 15 (c3) = 50
    // Morale: 50 + 0 (c1) - 15 (c3) = 35
    expect(getStoryMetrics(state)).toEqual([
      { metric: "Production", value: 50 },
      { metric: "Morale", value: 35 },
    ]);
  });

  test("returns empty array when there is no intro step", () => {
    const state = buildState({
      steps: [buildStoryStep("s1", 0)],
    });

    expect(getStoryMetrics(state)).toEqual([]);
  });
});

describe(getUpcomingImages, () => {
  test("returns empty array when no upcoming steps have images", () => {
    const state = buildState({
      steps: [
        buildStep({ id: "s1" }),
        buildStep({ id: "s2", position: 1 }),
        buildStep({ id: "s3", position: 2 }),
      ],
    });

    expect(getUpcomingImages(state)).toEqual([]);
  });

  test("extracts URL from a visual image step", () => {
    const state = buildState({
      steps: [
        buildStep({ id: "s1" }),
        buildStep({
          content: { kind: "image", prompt: "A cat", url: "https://example.com/cat.jpg" },
          id: "s2",
          kind: "visual",
          position: 1,
        }),
      ],
    });

    expect(getUpcomingImages(state)).toEqual([
      { kind: "visual", url: "https://example.com/cat.jpg" },
    ]);
  });

  test("extracts URLs from a selectImage step", () => {
    const state = buildState({
      steps: [
        buildStep({ id: "s1" }),
        buildStep({
          content: {
            options: [
              {
                feedback: "Yes",
                isCorrect: true,
                prompt: "Cat",
                url: "https://example.com/cat.jpg",
              },
              {
                feedback: "No",
                isCorrect: false,
                prompt: "Dog",
                url: "https://example.com/dog.jpg",
              },
            ],
            question: "Pick the cat",
          },
          id: "s2",
          kind: "selectImage",
          position: 1,
        }),
      ],
    });

    expect(getUpcomingImages(state)).toEqual([
      { kind: "selectImage", url: "https://example.com/cat.jpg" },
      { kind: "selectImage", url: "https://example.com/dog.jpg" },
    ]);
  });

  test("respects default lookahead of 3 steps", () => {
    const state = buildState({
      steps: [
        buildStep({ id: "s1" }),
        buildStep({
          content: { kind: "image", prompt: "One", url: "https://example.com/1.jpg" },
          id: "s2",
          kind: "visual",
          position: 1,
        }),
        buildStep({
          content: { kind: "image", prompt: "Two", url: "https://example.com/2.jpg" },
          id: "s3",
          kind: "visual",
          position: 2,
        }),
        buildStep({
          content: { kind: "image", prompt: "Three", url: "https://example.com/3.jpg" },
          id: "s4",
          kind: "visual",
          position: 3,
        }),
        buildStep({
          content: { kind: "image", prompt: "Four", url: "https://example.com/4.jpg" },
          id: "s5",
          kind: "visual",
          position: 4,
        }),
      ],
    });

    const result = getUpcomingImages(state);
    expect(result).toHaveLength(3);
    expect(result).toEqual([
      { kind: "visual", url: "https://example.com/1.jpg" },
      { kind: "visual", url: "https://example.com/2.jpg" },
      { kind: "visual", url: "https://example.com/3.jpg" },
    ]);
  });

  test("only looks ahead from current step, not behind", () => {
    const state = buildState({
      currentStepIndex: 2,
      steps: [
        buildStep({
          content: { kind: "image", prompt: "Behind", url: "https://example.com/behind.jpg" },
          id: "s1",
          kind: "visual",
        }),
        buildStep({
          content: {
            kind: "image",
            prompt: "Also behind",
            url: "https://example.com/also-behind.jpg",
          },
          id: "s2",
          kind: "visual",
          position: 1,
        }),
        buildStep({ id: "s3", position: 2 }),
        buildStep({
          content: { kind: "image", prompt: "Ahead", url: "https://example.com/ahead.jpg" },
          id: "s4",
          kind: "visual",
          position: 3,
        }),
      ],
    });

    expect(getUpcomingImages(state)).toEqual([
      { kind: "visual", url: "https://example.com/ahead.jpg" },
    ]);
  });

  test("skips visual steps that are not image kind", () => {
    const state = buildState({
      steps: [
        buildStep({ id: "s1" }),
        buildStep({
          content: { code: "console.log('hi')", kind: "code", language: "javascript" },
          id: "s2",
          kind: "visual",
          position: 1,
        }),
        buildStep({
          content: { author: "Author", kind: "quote", text: "Quote" },
          id: "s3",
          kind: "visual",
          position: 2,
        }),
      ],
    });

    expect(getUpcomingImages(state)).toEqual([]);
  });

  test("skips steps with missing or undefined URLs", () => {
    const state = buildState({
      steps: [
        buildStep({ id: "s1" }),
        buildStep({
          content: { kind: "image", prompt: "No URL" },
          id: "s2",
          kind: "visual",
          position: 1,
        }),
        buildStep({
          content: {
            options: [
              { feedback: "Yes", isCorrect: true, prompt: "No URL" },
              {
                feedback: "No",
                isCorrect: false,
                prompt: "Has URL",
                url: "https://example.com/img.jpg",
              },
            ],
            question: "Pick one",
          },
          id: "s3",
          kind: "selectImage",
          position: 2,
        }),
      ],
    });

    expect(getUpcomingImages(state)).toEqual([
      { kind: "selectImage", url: "https://example.com/img.jpg" },
    ]);
  });

  test("handles end-of-list with fewer than 3 steps remaining", () => {
    const state = buildState({
      currentStepIndex: 3,
      steps: [
        buildStep({ id: "s1" }),
        buildStep({ id: "s2", position: 1 }),
        buildStep({ id: "s3", position: 2 }),
        buildStep({ id: "s4", position: 3 }),
        buildStep({
          content: { kind: "image", prompt: "Last", url: "https://example.com/last.jpg" },
          id: "s5",
          kind: "visual",
          position: 4,
        }),
      ],
    });

    expect(getUpcomingImages(state)).toEqual([
      { kind: "visual", url: "https://example.com/last.jpg" },
    ]);
  });
});
