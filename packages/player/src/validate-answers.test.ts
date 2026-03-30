import { describe, expect, test } from "vitest";
import { validateAnswers } from "./validate-answers";

const coreMultipleChoiceContent = {
  kind: "core" as const,
  options: [
    { feedback: "Correct!", isCorrect: true, text: "Option A" },
    { feedback: "Wrong.", isCorrect: false, text: "Option B" },
  ],
};

const fillBlankContent = {
  answers: ["cat"],
  distractors: ["dog"],
  feedback: "Good",
  template: "The ___ sat",
};

describe(validateAnswers, () => {
  test("validates correct multipleChoice answer server-side", () => {
    const steps = [{ content: coreMultipleChoiceContent, id: 1n, kind: "multipleChoice" }];

    const results = validateAnswers(steps, {
      "1": { kind: "multipleChoice", selectedIndex: 0, selectedText: "Option A" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(true);
    expect(results[0]?.stepId).toBe(1n);
  });

  test("validates incorrect multipleChoice answer", () => {
    const steps = [{ content: coreMultipleChoiceContent, id: 1n, kind: "multipleChoice" }];

    const results = validateAnswers(steps, {
      "1": { kind: "multipleChoice", selectedIndex: 1, selectedText: "Option B" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(false);
  });

  test("validates fillBlank answer", () => {
    const steps = [{ content: fillBlankContent, id: 2n, kind: "fillBlank" }];

    const results = validateAnswers(steps, {
      "2": { kind: "fillBlank", userAnswers: ["dog"] },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(false);
  });

  test("skips steps with no client answer", () => {
    const steps = [
      { content: coreMultipleChoiceContent, id: 1n, kind: "multipleChoice" },
      { content: { text: "Hello", title: "Intro", variant: "text" }, id: 2n, kind: "static" },
    ];

    const results = validateAnswers(steps, {
      "1": { kind: "multipleChoice", selectedIndex: 0, selectedText: "Option A" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.stepId).toBe(1n);
  });

  test("validates translation answer against word ID", () => {
    const steps = [
      {
        content: {},
        id: 4n,
        kind: "translation",
        word: { id: 100n },
      },
    ];

    const results = validateAnswers(steps, {
      "4": {
        kind: "translation",
        questionText: "palabra",
        selectedText: "word",
        selectedWordId: "100",
      },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(true);
  });

  test("translation answer with wrong word ID is incorrect", () => {
    const steps = [
      {
        content: {},
        id: 4n,
        kind: "translation",
        word: { id: 100n },
      },
    ];

    const results = validateAnswers(steps, {
      "4": {
        kind: "translation",
        questionText: "palabra",
        selectedText: "wrong",
        selectedWordId: "999",
      },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(false);
  });

  test("validates reading answer against sentence words", () => {
    const steps = [
      {
        content: {},
        id: 5n,
        kind: "reading",
        sentence: {
          distractors: [],
          id: 1n,
          sentence: "hello world",
          translation: "olá mundo",
          translationDistractors: [],
        },
      },
    ];

    const results = validateAnswers(steps, {
      "5": { arrangedWords: ["hello", "world"], kind: "reading" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(true);
  });

  test("validates listening answer against translation words", () => {
    const steps = [
      {
        content: {},
        id: 6n,
        kind: "listening",
        sentence: {
          distractors: [],
          id: 1n,
          sentence: "hello world",
          translation: "olá mundo",
          translationDistractors: [],
        },
      },
    ];

    const results = validateAnswers(steps, {
      "6": { arrangedWords: ["olá", "mundo"], kind: "listening" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(true);
  });

  test("rejects non-canonical reading answers", () => {
    const steps = [
      {
        content: {},
        id: 7n,
        kind: "reading",
        sentence: {
          distractors: ["morgen"],
          id: 1n,
          sentence: "guten tag lara",
          translation: "bom dia lara",
          translationDistractors: [],
        },
      },
    ];

    const results = validateAnswers(steps, {
      "7": { arrangedWords: ["guten", "morgen", "lara"], kind: "reading" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(false);
  });

  test("rejects non-canonical listening answers", () => {
    const steps = [
      {
        content: {},
        id: 10n,
        kind: "listening",
        sentence: {
          distractors: [],
          id: 1n,
          sentence: "guten tag lara",
          translation: "boa tarde lara",
          translationDistractors: ["bom"],
        },
      },
    ];

    const results = validateAnswers(steps, {
      "10": { arrangedWords: ["bom", "dia", "lara"], kind: "listening" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(false);
  });

  test("accepts punctuation-insensitive listening answers", () => {
    const steps = [
      {
        content: {},
        id: 8n,
        kind: "listening",
        sentence: {
          distractors: [],
          id: 1n,
          sentence: "hello lara",
          translation: "bom dia, lara!",
          translationDistractors: [],
        },
      },
    ];

    const results = validateAnswers(steps, {
      "8": { arrangedWords: ["bom", "dia", "lara"], kind: "listening" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(true);
  });

  test("skips unsupported step kinds", () => {
    const steps = [{ content: {}, id: 7n, kind: "unknownKind" }];

    const results = validateAnswers(steps, {
      "7": { kind: "multipleChoice", selectedIndex: 0, selectedText: "Option A" },
    });

    expect(results).toHaveLength(0);
  });
});
