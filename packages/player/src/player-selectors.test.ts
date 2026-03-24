import { describe, expect, test } from "vitest";
import { type PlayerState } from "./player-reducer";
import { getUpcomingImages } from "./player-selectors";
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
    dimensions: {},
    phase: "playing",
    previousDimensions: {},
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
