import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { describe, expect, test } from "vitest";
import { checkStep } from "./check-step";
import { type SelectedAnswer } from "./player-reducer";

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

describe(checkStep, () => {
  describe("multipleChoice core", () => {
    const step = buildStep({
      content: {
        kind: "core" as const,
        options: [
          { feedback: "Correct!", id: "four", isCorrect: true, text: "4" },
          { feedback: "Wrong!", id: "three", isCorrect: false, text: "3" },
        ],
        question: "What is 2+2?",
      },
      id: "mc-1",
      kind: "multipleChoice",
    });

    test("correct answer returns isCorrect true", () => {
      const answer: SelectedAnswer = {
        kind: "multipleChoice",
        selectedOptionId: "four",
      };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBe(true);
      expect(result.feedback).toBe("Correct!");
    });

    test("incorrect answer returns isCorrect false", () => {
      const answer: SelectedAnswer = {
        kind: "multipleChoice",
        selectedOptionId: "three",
      };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBe(false);
      expect(result.feedback).toBe("Wrong!");
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
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBe(true);
    });

    test("incorrect answer", () => {
      const answer: SelectedAnswer = { kind: "fillBlank", userAnswers: ["ground"] };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBe(false);
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
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBe(true);
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
      expect(result.isCorrect).toBe(false);
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
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBe(true);
    });

    test("incorrect order", () => {
      const answer: SelectedAnswer = {
        kind: "sortOrder",
        userOrder: ["third", "first", "second"],
      };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBe(false);
    });
  });

  describe("selectImage", () => {
    const step = buildStep({
      content: {
        options: [
          { feedback: "Yes!", id: "cat", isCorrect: true, prompt: "Cat" },
          { feedback: "No!", id: "dog", isCorrect: false, prompt: "Dog" },
        ],
        question: "Select the correct image",
      },
      id: "img-1",
      kind: "selectImage",
    });

    test("correct selection", () => {
      const answer: SelectedAnswer = { kind: "selectImage", selectedOptionId: "cat" };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBe(true);
    });

    test("incorrect selection", () => {
      const answer: SelectedAnswer = { kind: "selectImage", selectedOptionId: "dog" };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBe(false);
    });
  });

  describe("translation", () => {
    const step = buildStep({
      content: {},
      id: "translation-1",
      kind: "translation",
      word: {
        audioUrl: null,
        distractors: [],
        id: "word-1",
        pronunciation: null,
        romanization: null,
        translation: "hola",
        word: "hello",
      },
    });

    test("correct word", () => {
      const answer: SelectedAnswer = { kind: "translation", selectedOptionId: "word-1" };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBe(true);
    });

    test("incorrect word", () => {
      const answer: SelectedAnswer = { kind: "translation", selectedOptionId: "word-99" };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBe(false);
    });
  });

  describe("vocabulary flashcard", () => {
    test("returns mismatch result for flashcard step", () => {
      const step = buildStep({
        content: {},
        id: "vocab-1",
        kind: "vocabulary",
      });
      const answer: SelectedAnswer = {
        kind: "translation",
        selectedOptionId: "word-1",
      };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBe(false);
      expect(result.feedback).toBeNull();
    });
  });

  describe("reading", () => {
    const step = buildStep({
      content: {},
      id: "reading-1",
      kind: "reading",
      sentence: {
        audioUrl: null,
        distractors: [],
        explanation: null,
        id: "sent-1",
        romanization: null,
        sentence: "Hello world",
        translation: "Hola mundo",
        translationDistractors: [],
      },
    });

    test("correct word arrangement", () => {
      const answer: SelectedAnswer = { arrangedWords: ["Hello", "world"], kind: "reading" };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBe(true);
      expect(result.correctAnswer).toBe("Hello world");
    });

    test("incorrect word arrangement returns correct answer", () => {
      const answer: SelectedAnswer = { arrangedWords: ["world", "Hello"], kind: "reading" };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBe(false);
      expect(result.correctAnswer).toBe("Hello world");
    });

    test("returns explanation as feedback", () => {
      const stepWithExplanation = buildStep({
        content: {},
        id: "reading-2",
        kind: "reading",
        sentence: {
          audioUrl: null,
          distractors: [],
          explanation: "Word order matters in this language.",
          id: "sent-3",
          romanization: null,
          sentence: "Hello world",
          translation: "Hola mundo",
          translationDistractors: [],
        },
      });
      const answer: SelectedAnswer = { arrangedWords: ["world", "Hello"], kind: "reading" };
      const { result } = checkStep(stepWithExplanation, answer);
      expect(result.feedback).toBe("Word order matters in this language.");
    });

    test("rejects non-canonical reading answers", () => {
      const stepWithDistractors = buildStep({
        content: {},
        id: "reading-3",
        kind: "reading",
        sentence: {
          audioUrl: null,
          distractors: ["Morgen"],
          explanation: null,
          id: "sent-5",
          romanization: null,
          sentence: "Guten Tag, Lara.",
          translation: "Boa tarde, Lara.",
          translationDistractors: [],
        },
      });

      const answer: SelectedAnswer = {
        arrangedWords: ["Guten", "Morgen,", "Lara."],
        kind: "reading",
      };
      const { result } = checkStep(stepWithDistractors, answer);

      expect(result.isCorrect).toBe(false);
      expect(result.correctAnswer).toBe("Guten Tag, Lara.");
    });
  });

  describe("listening", () => {
    const step = buildStep({
      content: {},
      id: "listening-1",
      kind: "listening",
      sentence: {
        audioUrl: null,
        distractors: [],
        explanation: null,
        id: "sent-2",
        romanization: null,
        sentence: "Good morning",
        translation: "Buenos dias",
        translationDistractors: [],
      },
    });

    test("correct word arrangement uses translation", () => {
      const answer: SelectedAnswer = { arrangedWords: ["Buenos", "dias"], kind: "listening" };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBe(true);
      expect(result.correctAnswer).toBe("Buenos dias");
    });

    test("incorrect word arrangement returns correct answer", () => {
      const answer: SelectedAnswer = { arrangedWords: ["dias", "Buenos"], kind: "listening" };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBe(false);
      expect(result.correctAnswer).toBe("Buenos dias");
    });

    test("returns explanation as feedback", () => {
      const stepWithExplanation = buildStep({
        content: {},
        id: "listening-2",
        kind: "listening",
        sentence: {
          audioUrl: null,
          distractors: [],
          explanation: "Pay attention to accent marks.",
          id: "sent-4",
          romanization: null,
          sentence: "Good morning",
          translation: "Buenos dias",
          translationDistractors: [],
        },
      });
      const answer: SelectedAnswer = { arrangedWords: ["dias", "Buenos"], kind: "listening" };
      const { result } = checkStep(stepWithExplanation, answer);
      expect(result.feedback).toBe("Pay attention to accent marks.");
    });

    test("rejects non-canonical listening answers", () => {
      const stepWithDistractors = buildStep({
        content: {},
        id: "listening-3",
        kind: "listening",
        sentence: {
          audioUrl: null,
          distractors: [],
          explanation: null,
          id: "sent-6",
          romanization: null,
          sentence: "Guten Tag, Lara.",
          translation: "Boa tarde, Lara.",
          translationDistractors: ["Bom"],
        },
      });

      const answer: SelectedAnswer = {
        arrangedWords: ["Bom", "dia,", "Lara."],
        kind: "listening",
      };
      const { result } = checkStep(stepWithDistractors, answer);

      expect(result.isCorrect).toBe(false);
      expect(result.correctAnswer).toBe("Boa tarde, Lara.");
    });
  });

  describe("mismatched kinds", () => {
    test("multipleChoice step with fillBlank answer returns safe fallback", () => {
      const step = buildStep({
        content: {
          kind: "core" as const,
          options: [{ feedback: "OK", id: "a", isCorrect: true, text: "A" }],
          question: "Test",
        },
        kind: "multipleChoice",
      });
      const answer: SelectedAnswer = { kind: "fillBlank", userAnswers: ["test"] };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBe(false);
      expect(result.feedback).toBeNull();
    });

    test("static step returns mismatch result", () => {
      const step = buildStep();
      const answer: SelectedAnswer = { kind: "multipleChoice", selectedOptionId: "missing" };
      const { result } = checkStep(step, answer);
      expect(result.isCorrect).toBe(false);
      expect(result.feedback).toBeNull();
    });
  });
});
