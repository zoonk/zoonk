import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { describe, expect, test } from "vitest";
import { getMockAnswer, getStepSummary } from "./step-renderer-utils";

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

describe(getStepSummary, () => {
  test("returns question for multipleChoice core", () => {
    const step = buildStep({
      content: {
        kind: "core" as const,
        options: [{ feedback: "!", isCorrect: true, text: "4" }],
        question: "What is 2+2?",
      },
      kind: "multipleChoice",
    });
    expect(getStepSummary(step)).toBe("What is 2+2?");
  });

  test("returns question for multipleChoice challenge", () => {
    const step = buildStep({
      content: {
        context: "ctx",
        kind: "challenge" as const,
        options: [{ consequence: "ok", effects: [], text: "A" }],
        question: "What do you do?",
      },
      kind: "multipleChoice",
    });
    expect(getStepSummary(step)).toBe("What do you do?");
  });

  test("returns context for multipleChoice language", () => {
    const step = buildStep({
      content: {
        context: "Hola",
        contextRomanization: null,
        contextTranslation: "Hello",
        kind: "language" as const,
        options: [{ feedback: "!", isCorrect: true, text: "Hi", textRomanization: null }],
      },
      kind: "multipleChoice",
    });
    expect(getStepSummary(step)).toBe("Hola");
  });

  test("returns template for fillBlank", () => {
    const step = buildStep({
      content: { answers: ["sky"], distractors: [], feedback: "!", template: "The ___ is blue" },
      kind: "fillBlank",
    });
    expect(getStepSummary(step)).toBe("The ___ is blue");
  });

  test("returns question for matchColumns", () => {
    const step = buildStep({
      content: { pairs: [{ left: "A", right: "1" }], question: "Match pairs" },
      kind: "matchColumns",
    });
    expect(getStepSummary(step)).toBe("Match pairs");
  });

  test("returns question for sortOrder", () => {
    const step = buildStep({
      content: { feedback: "!", items: ["a", "b"], question: "Sort these" },
      kind: "sortOrder",
    });
    expect(getStepSummary(step)).toBe("Sort these");
  });

  test("returns question for selectImage", () => {
    const step = buildStep({
      content: {
        options: [{ feedback: "!", isCorrect: true, prompt: "Cat" }],
        question: "Pick one",
      },
      kind: "selectImage",
    });
    expect(getStepSummary(step)).toBe("Pick one");
  });

  test("returns title for static text", () => {
    const step = buildStep({
      content: { text: "Body", title: "Welcome", variant: "text" as const },
      kind: "static",
    });
    expect(getStepSummary(step)).toBe("Welcome");
  });

  test("returns sentence for static grammarExample", () => {
    const step = buildStep({
      content: {
        highlight: "runs",
        romanization: null,
        sentence: "She runs",
        translation: "Ella corre",
        variant: "grammarExample" as const,
      },
      kind: "static",
    });
    expect(getStepSummary(step)).toBe("She runs");
  });

  test("returns ruleName for static grammarRule", () => {
    const step = buildStep({
      content: {
        ruleName: "Past tense",
        ruleSummary: "Add -ed",
        variant: "grammarRule" as const,
      },
      kind: "static",
    });
    expect(getStepSummary(step)).toBe("Past tense");
  });

  test("returns word for vocabulary", () => {
    const step = buildStep({
      content: {},
      kind: "vocabulary",
      word: {
        audioUrl: null,
        id: "w1",
        pronunciation: null,
        romanization: null,
        translation: "hola",
        word: "hello",
      },
    });
    expect(getStepSummary(step)).toBe("hello");
  });

  test("returns sentence for reading", () => {
    const step = buildStep({
      content: {},
      kind: "reading",
      sentence: {
        audioUrl: null,
        id: "s1",
        romanization: null,
        sentence: "Hello world",
        translation: "Hola mundo",
      },
    });
    expect(getStepSummary(step)).toBe("Hello world");
  });

  test("returns sentence for listening", () => {
    const step = buildStep({
      content: {},
      kind: "listening",
      sentence: {
        audioUrl: null,
        id: "s2",
        romanization: null,
        sentence: "Good morning",
        translation: "Buenos dias",
      },
    });
    expect(getStepSummary(step)).toBe("Good morning");
  });
});

describe(getMockAnswer, () => {
  test("returns correct option index for multipleChoice core", () => {
    const step = buildStep({
      content: {
        kind: "core" as const,
        options: [
          { feedback: "No", isCorrect: false, text: "Wrong" },
          { feedback: "Yes", isCorrect: true, text: "Right" },
        ],
        question: "Q",
      },
      kind: "multipleChoice",
    });
    expect(getMockAnswer(step)).toEqual({ kind: "multipleChoice", selectedIndex: 1 });
  });

  test("returns index 0 for multipleChoice challenge", () => {
    const step = buildStep({
      content: {
        context: "ctx",
        kind: "challenge" as const,
        options: [{ consequence: "ok", effects: [], text: "A" }],
        question: "Q",
      },
      kind: "multipleChoice",
    });
    expect(getMockAnswer(step)).toEqual({ kind: "multipleChoice", selectedIndex: 0 });
  });

  test("returns correct option index for multipleChoice language", () => {
    const step = buildStep({
      content: {
        context: "Hola",
        contextRomanization: null,
        contextTranslation: "Hello",
        kind: "language" as const,
        options: [
          { feedback: "No", isCorrect: false, text: "Goodbye", textRomanization: null },
          { feedback: "Yes", isCorrect: true, text: "Hello", textRomanization: null },
        ],
      },
      kind: "multipleChoice",
    });
    expect(getMockAnswer(step)).toEqual({ kind: "multipleChoice", selectedIndex: 1 });
  });

  test("returns answers for fillBlank", () => {
    const step = buildStep({
      content: { answers: ["sky"], distractors: [], feedback: "!", template: "The ___ is blue" },
      kind: "fillBlank",
    });
    expect(getMockAnswer(step)).toEqual({ kind: "fillBlank", userAnswers: ["sky"] });
  });

  test("returns pairs for matchColumns", () => {
    const step = buildStep({
      content: { pairs: [{ left: "A", right: "1" }], question: "Match" },
      kind: "matchColumns",
    });
    expect(getMockAnswer(step)).toEqual({
      kind: "matchColumns",
      userPairs: [{ left: "A", right: "1" }],
    });
  });

  test("returns items for sortOrder", () => {
    const step = buildStep({
      content: { feedback: "!", items: ["a", "b", "c"], question: "Sort" },
      kind: "sortOrder",
    });
    expect(getMockAnswer(step)).toEqual({ kind: "sortOrder", userOrder: ["a", "b", "c"] });
  });

  test("returns correct image index for selectImage", () => {
    const step = buildStep({
      content: {
        options: [
          { feedback: "No", isCorrect: false, prompt: "A" },
          { feedback: "Yes", isCorrect: true, prompt: "B" },
        ],
        question: "Pick",
      },
      kind: "selectImage",
    });
    expect(getMockAnswer(step)).toEqual({ kind: "selectImage", selectedIndex: 1 });
  });

  test("returns word id for vocabulary", () => {
    const step = buildStep({
      content: {},
      kind: "vocabulary",
      word: {
        audioUrl: null,
        id: "w1",
        pronunciation: null,
        romanization: null,
        translation: "hola",
        word: "hello",
      },
    });
    expect(getMockAnswer(step)).toEqual({ kind: "vocabulary", selectedWordId: "w1" });
  });

  test("returns arranged words for reading", () => {
    const step = buildStep({
      content: {},
      kind: "reading",
      sentence: {
        audioUrl: null,
        id: "s1",
        romanization: null,
        sentence: "Hello world",
        translation: "Hola mundo",
      },
    });
    expect(getMockAnswer(step)).toEqual({ arrangedWords: ["Hello", "world"], kind: "reading" });
  });

  test("returns arranged words for listening", () => {
    const step = buildStep({
      content: {},
      kind: "listening",
      sentence: {
        audioUrl: null,
        id: "s2",
        romanization: null,
        sentence: "Good morning",
        translation: "Buenos dias",
      },
    });
    expect(getMockAnswer(step)).toEqual({
      arrangedWords: ["Good", "morning"],
      kind: "listening",
    });
  });

  test("returns null for static step", () => {
    const step = buildStep();
    expect(getMockAnswer(step)).toBeNull();
  });
});
