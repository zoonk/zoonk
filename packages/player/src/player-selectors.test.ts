import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { describe, expect, test } from "vitest";
import { type PlayerState } from "./player-reducer";
import { getUpcomingImages } from "./player-selectors";

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

  test("extracts URL from a static step image", () => {
    const state = buildState({
      steps: [
        buildStep({ id: "s1" }),
        buildStep({
          content: {
            image: { prompt: "A cat", url: "https://example.com/cat.jpg" },
            text: "Cat step",
            title: "Cat",
            variant: "text",
          },
          id: "s2",
          position: 1,
        }),
      ],
    });

    expect(getUpcomingImages(state)).toEqual([
      { kind: "step", url: "https://example.com/cat.jpg" },
    ]);
  });

  test("extracts URL from a multipleChoice step image", () => {
    const state = buildState({
      steps: [
        buildStep({ id: "s1" }),
        buildStep({
          content: {
            context: "Maya points at the refund dashboard.",
            image: {
              prompt: "A refund dashboard with one mismatched total highlighted",
              url: "https://example.com/refund-dashboard.jpg",
            },
            kind: "core",
            options: [
              { feedback: "Yes", id: "Check totals", isCorrect: true, text: "Check totals" },
            ],
            question: "What should we inspect?",
          },
          id: "s2",
          kind: "multipleChoice",
          position: 1,
        }),
      ],
    });

    expect(getUpcomingImages(state)).toEqual([
      { kind: "step", url: "https://example.com/refund-dashboard.jpg" },
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
                id: "cat",
                isCorrect: true,
                prompt: "Cat",
                url: "https://example.com/cat.jpg",
              },
              {
                feedback: "No",
                id: "dog",
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
          content: {
            image: { prompt: "One", url: "https://example.com/1.jpg" },
            text: "One",
            title: "One",
            variant: "text",
          },
          id: "s2",
          position: 1,
        }),
        buildStep({
          content: {
            image: { prompt: "Two", url: "https://example.com/2.jpg" },
            text: "Two",
            title: "Two",
            variant: "text",
          },
          id: "s3",
          position: 2,
        }),
        buildStep({
          content: {
            image: { prompt: "Three", url: "https://example.com/3.jpg" },
            text: "Three",
            title: "Three",
            variant: "text",
          },
          id: "s4",
          position: 3,
        }),
        buildStep({
          content: {
            image: { prompt: "Four", url: "https://example.com/4.jpg" },
            text: "Four",
            title: "Four",
            variant: "text",
          },
          id: "s5",
          position: 4,
        }),
      ],
    });

    expect(getUpcomingImages(state)).toEqual([
      { kind: "step", url: "https://example.com/1.jpg" },
      { kind: "step", url: "https://example.com/2.jpg" },
      { kind: "step", url: "https://example.com/3.jpg" },
    ]);
  });

  test("only looks ahead from current step, not behind", () => {
    const state = buildState({
      currentStepIndex: 2,
      steps: [
        buildStep({
          content: {
            image: { prompt: "Behind", url: "https://example.com/behind.jpg" },
            text: "Behind",
            title: "Behind",
            variant: "text",
          },
          id: "s1",
        }),
        buildStep({
          content: {
            image: {
              prompt: "Also behind",
              url: "https://example.com/also-behind.jpg",
            },
            text: "Also behind",
            title: "Also behind",
            variant: "text",
          },
          id: "s2",
          position: 1,
        }),
        buildStep({ id: "s3", position: 2 }),
        buildStep({
          content: {
            image: { prompt: "Ahead", url: "https://example.com/ahead.jpg" },
            text: "Ahead",
            title: "Ahead",
            variant: "text",
          },
          id: "s4",
          position: 3,
        }),
      ],
    });

    expect(getUpcomingImages(state)).toEqual([
      { kind: "step", url: "https://example.com/ahead.jpg" },
    ]);
  });

  test("skips steps with missing or undefined URLs", () => {
    const state = buildState({
      steps: [
        buildStep({ id: "s1" }),
        buildStep({
          content: {
            image: { prompt: "No URL" },
            text: "Missing URL",
            title: "Missing URL",
            variant: "text",
          },
          id: "s2",
          position: 1,
        }),
        buildStep({
          content: {
            options: [
              { feedback: "Yes", id: "no-url", isCorrect: true, prompt: "No URL" },
              {
                feedback: "No",
                id: "has-url",
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
});
