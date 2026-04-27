import { describe, expect, test } from "vitest";
import { validateAnswers } from "./validate-answers";

const coreMultipleChoiceContent = {
  kind: "core" as const,
  options: [
    { feedback: "Correct!", id: "option-a", isCorrect: true, text: "Option A" },
    { feedback: "Wrong.", id: "option-b", isCorrect: false, text: "Option B" },
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
    const steps = [{ content: coreMultipleChoiceContent, id: "1", kind: "multipleChoice" }];

    const results = validateAnswers(steps, {
      "1": { kind: "multipleChoice", selectedOptionId: "option-a" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(true);
    expect(results[0]?.stepId).toBe("1");
  });

  test("validates incorrect multipleChoice answer", () => {
    const steps = [{ content: coreMultipleChoiceContent, id: "1", kind: "multipleChoice" }];

    const results = validateAnswers(steps, {
      "1": { kind: "multipleChoice", selectedOptionId: "option-b" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(false);
  });

  test("validates fillBlank answer", () => {
    const steps = [{ content: fillBlankContent, id: "2", kind: "fillBlank" }];

    const results = validateAnswers(steps, {
      "2": { kind: "fillBlank", userAnswers: ["dog"] },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(false);
  });

  test("skips steps with no client answer", () => {
    const steps = [
      { content: coreMultipleChoiceContent, id: "1", kind: "multipleChoice" },
      { content: { text: "Hello", title: "Intro", variant: "text" }, id: "2", kind: "static" },
    ];

    const results = validateAnswers(steps, {
      "1": { kind: "multipleChoice", selectedOptionId: "option-a" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.stepId).toBe("1");
  });

  test("validates translation answer against word ID", () => {
    const steps = [
      {
        content: {},
        id: "4",
        kind: "translation",
        word: { id: "100" },
      },
    ];

    const results = validateAnswers(steps, {
      "4": { kind: "translation", selectedOptionId: "100" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(true);
  });

  test("translation answer with wrong word ID is incorrect", () => {
    const steps = [
      {
        content: {},
        id: "4",
        kind: "translation",
        word: { id: "100" },
      },
    ];

    const results = validateAnswers(steps, {
      "4": { kind: "translation", selectedOptionId: "999" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(false);
  });

  test("validates reading answer against sentence words", () => {
    const steps = [
      {
        content: {},
        id: "5",
        kind: "reading",
        sentence: {
          distractors: [],
          id: "1",
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
        id: "6",
        kind: "listening",
        sentence: {
          distractors: [],
          id: "1",
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
        id: "7",
        kind: "reading",
        sentence: {
          distractors: ["morgen"],
          id: "1",
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
        id: "10",
        kind: "listening",
        sentence: {
          distractors: [],
          id: "1",
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
        id: "8",
        kind: "listening",
        sentence: {
          distractors: [],
          id: "1",
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
    const steps = [{ content: {}, id: "7", kind: "unknownKind" }];

    const results = validateAnswers(steps, {
      "7": { kind: "multipleChoice", selectedOptionId: "option-a" },
    });

    expect(results).toHaveLength(0);
  });

  test("skips malformed unanswered static steps instead of throwing", () => {
    const steps = [{ content: { text: "Legacy static step" }, id: "16", kind: "static" }];

    const runValidation = () => validateAnswers(steps, {});

    expect(runValidation).not.toThrow();
    expect(runValidation()).toEqual([]);
  });
});
