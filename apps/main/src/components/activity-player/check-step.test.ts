import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { describe, expect, test } from "vitest";
import { checkStep } from "./check-step";
import { type SelectedAnswer } from "./player-reducer";

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

describe(checkStep, () => {
  describe("multipleChoice core", () => {
    const step = buildStep({
      content: {
        kind: "core" as const,
        options: [
          { feedback: "Correct!", isCorrect: true, text: "4" },
          { feedback: "Wrong!", isCorrect: false, text: "3" },
        ],
        question: "What is 2+2?",
      },
      id: "mc-1",
      kind: "multipleChoice",
    });

    test("correct answer returns isCorrect true with empty effects", () => {
      const answer: SelectedAnswer = { kind: "multipleChoice", selectedIndex: 0 };
      const { effects, result } = checkStep(step, answer);
      expect(result.isCorrect).toBeTruthy();
      expect(result.feedback).toBe("Correct!");
      expect(effects).toEqual([]);
    });

    test("incorrect answer returns isCorrect false", () => {
      const answer: SelectedAnswer = { kind: "multipleChoice", selectedIndex: 1 };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBeFalsy();
      expect(result.feedback).toBe("Wrong!");
    });
  });

  describe("multipleChoice challenge", () => {
    const step = buildStep({
      content: {
        context: "You are a manager",
        kind: "challenge" as const,
        options: [
          {
            consequence: "Good result",
            effects: [{ dimension: "Quality", impact: "positive" as const }],
            text: "Option A",
          },
          {
            consequence: "Bad result",
            effects: [{ dimension: "Quality", impact: "negative" as const }],
            text: "Option B",
          },
        ],
        question: "What do you do?",
      },
      id: "mc-challenge",
      kind: "multipleChoice",
    });

    test("returns effects from selected option", () => {
      const answer: SelectedAnswer = { kind: "multipleChoice", selectedIndex: 0 };
      const { effects, result } = checkStep(step, answer);
      expect(result.isCorrect).toBeTruthy();
      expect(effects).toEqual([{ dimension: "Quality", impact: "positive" }]);
    });

    test("returns effects from second option", () => {
      const answer: SelectedAnswer = { kind: "multipleChoice", selectedIndex: 1 };
      const { effects } = checkStep(step, answer);
      expect(effects).toEqual([{ dimension: "Quality", impact: "negative" }]);
    });
  });

  describe("fillBlank", () => {
    const step = buildStep({
      content: {
        answers: ["sky"],
        distractors: ["ground"],
        feedback: "The sky is blue",
        template: "The ___ is blue",
      },
      id: "fb-1",
      kind: "fillBlank",
    });

    test("correct answer", () => {
      const answer: SelectedAnswer = { kind: "fillBlank", userAnswers: ["sky"] };
      const { effects, result } = checkStep(step, answer);
      expect(result.isCorrect).toBeTruthy();
      expect(effects).toEqual([]);
    });

    test("incorrect answer", () => {
      const answer: SelectedAnswer = { kind: "fillBlank", userAnswers: ["ground"] };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBeFalsy();
    });
  });

  describe("matchColumns", () => {
    const step = buildStep({
      content: {
        pairs: [
          { left: "A", right: "1" },
          { left: "B", right: "2" },
        ],
        question: "Match the pairs",
      },
      id: "match-1",
      kind: "matchColumns",
    });

    test("correct pairs", () => {
      const answer: SelectedAnswer = {
        kind: "matchColumns",
        mistakes: 0,
        userPairs: [
          { left: "A", right: "1" },
          { left: "B", right: "2" },
        ],
      };
      const { effects, result } = checkStep(step, answer);
      expect(result.isCorrect).toBeTruthy();
      expect(effects).toEqual([]);
    });

    test("incorrect pairs", () => {
      const answer: SelectedAnswer = {
        kind: "matchColumns",
        mistakes: 0,
        userPairs: [
          { left: "A", right: "2" },
          { left: "B", right: "1" },
        ],
      };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBeFalsy();
    });
  });

  describe("sortOrder", () => {
    const step = buildStep({
      content: {
        feedback: "Correct order",
        items: ["first", "second", "third"],
        question: "Sort these",
      },
      id: "sort-1",
      kind: "sortOrder",
    });

    test("correct order", () => {
      const answer: SelectedAnswer = {
        kind: "sortOrder",
        userOrder: ["first", "second", "third"],
      };
      const { effects, result } = checkStep(step, answer);
      expect(result.isCorrect).toBeTruthy();
      expect(effects).toEqual([]);
    });

    test("incorrect order", () => {
      const answer: SelectedAnswer = {
        kind: "sortOrder",
        userOrder: ["third", "first", "second"],
      };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBeFalsy();
    });
  });

  describe("selectImage", () => {
    const step = buildStep({
      content: {
        options: [
          { feedback: "Yes!", isCorrect: true, prompt: "Cat" },
          { feedback: "No!", isCorrect: false, prompt: "Dog" },
        ],
        question: "Select the correct image",
      },
      id: "img-1",
      kind: "selectImage",
    });

    test("correct selection", () => {
      const answer: SelectedAnswer = { kind: "selectImage", selectedIndex: 0 };
      const { effects, result } = checkStep(step, answer);
      expect(result.isCorrect).toBeTruthy();
      expect(effects).toEqual([]);
    });

    test("incorrect selection", () => {
      const answer: SelectedAnswer = { kind: "selectImage", selectedIndex: 1 };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBeFalsy();
    });
  });

  describe("vocabulary", () => {
    const step = buildStep({
      content: {},
      id: "vocab-1",
      kind: "vocabulary",
      word: {
        audioUrl: null,
        id: "word-1",
        pronunciation: null,
        romanization: null,
        translation: "hola",
        word: "hello",
      },
    });

    test("correct word", () => {
      const answer: SelectedAnswer = { kind: "vocabulary", selectedWordId: "word-1" };
      const { effects, result } = checkStep(step, answer);
      expect(result.isCorrect).toBeTruthy();
      expect(effects).toEqual([]);
    });

    test("incorrect word", () => {
      const answer: SelectedAnswer = { kind: "vocabulary", selectedWordId: "word-99" };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBeFalsy();
    });
  });

  describe("reading", () => {
    const step = buildStep({
      content: {},
      id: "reading-1",
      kind: "reading",
      sentence: {
        audioUrl: null,
        id: "sent-1",
        romanization: null,
        sentence: "Hello world",
        translation: "Hola mundo",
      },
    });

    test("correct word arrangement", () => {
      const answer: SelectedAnswer = { arrangedWords: ["Hello", "world"], kind: "reading" };
      const { effects, result } = checkStep(step, answer);
      expect(result.isCorrect).toBeTruthy();
      expect(effects).toEqual([]);
    });

    test("incorrect word arrangement", () => {
      const answer: SelectedAnswer = { arrangedWords: ["world", "Hello"], kind: "reading" };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBeFalsy();
    });
  });

  describe("listening", () => {
    const step = buildStep({
      content: {},
      id: "listening-1",
      kind: "listening",
      sentence: {
        audioUrl: null,
        id: "sent-2",
        romanization: null,
        sentence: "Good morning",
        translation: "Buenos dias",
      },
    });

    test("correct word arrangement", () => {
      const answer: SelectedAnswer = { arrangedWords: ["Good", "morning"], kind: "listening" };
      const { effects, result } = checkStep(step, answer);
      expect(result.isCorrect).toBeTruthy();
      expect(effects).toEqual([]);
    });

    test("incorrect word arrangement", () => {
      const answer: SelectedAnswer = { arrangedWords: ["morning", "Good"], kind: "listening" };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBeFalsy();
    });
  });

  describe("mismatched kinds", () => {
    test("multipleChoice step with fillBlank answer returns safe fallback", () => {
      const step = buildStep({
        content: {
          kind: "core" as const,
          options: [{ feedback: "OK", isCorrect: true, text: "A" }],
          question: "Test",
        },
        kind: "multipleChoice",
      });
      const answer: SelectedAnswer = { kind: "fillBlank", userAnswers: ["test"] };
      const { effects, result } = checkStep(step, answer);
      expect(result.isCorrect).toBeFalsy();
      expect(result.feedback).toBeNull();
      expect(effects).toEqual([]);
    });

    test("static step returns mismatch result", () => {
      const step = buildStep();
      const answer: SelectedAnswer = { kind: "multipleChoice", selectedIndex: 0 };
      const { effects, result } = checkStep(step, answer);
      expect(result.isCorrect).toBeFalsy();
      expect(result.feedback).toBeNull();
      expect(effects).toEqual([]);
    });
  });
});
