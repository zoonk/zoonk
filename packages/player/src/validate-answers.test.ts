import { describe, expect, test } from "vitest";
import { validateAnswers } from "./validate-answers";

const coreMultipleChoiceContent = {
  kind: "core" as const,
  options: [
    { feedback: "Correct!", isCorrect: true, text: "Option A" },
    { feedback: "Wrong.", isCorrect: false, text: "Option B" },
  ],
};

const challengeMultipleChoiceContent = {
  context: "A scenario",
  kind: "challenge" as const,
  options: [
    {
      consequence: "Good choice",
      effects: [{ dimension: "Courage", impact: "positive" as const }],
      text: "Option A",
    },
    {
      consequence: "Bad choice",
      effects: [{ dimension: "Diplomacy", impact: "negative" as const }],
      text: "Option B",
    },
  ],
  question: "What do you do?",
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
      "1": { kind: "multipleChoice", selectedIndex: 0 },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBeTruthy();
    expect(results[0]?.stepId).toBe(1n);
    expect(results[0]?.effects).toEqual([]);
  });

  test("validates incorrect multipleChoice answer", () => {
    const steps = [{ content: coreMultipleChoiceContent, id: 1n, kind: "multipleChoice" }];

    const results = validateAnswers(steps, {
      "1": { kind: "multipleChoice", selectedIndex: 1 },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBeFalsy();
  });

  test("validates fillBlank answer", () => {
    const steps = [{ content: fillBlankContent, id: 2n, kind: "fillBlank" }];

    const results = validateAnswers(steps, {
      "2": { kind: "fillBlank", userAnswers: ["dog"] },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBeFalsy();
  });

  test("challenge multipleChoice returns effects", () => {
    const steps = [{ content: challengeMultipleChoiceContent, id: 3n, kind: "multipleChoice" }];

    const results = validateAnswers(steps, {
      "3": { kind: "multipleChoice", selectedIndex: 0 },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.effects).toEqual([{ dimension: "Courage", impact: "positive" }]);
  });

  test("skips steps with no client answer", () => {
    const steps = [
      { content: coreMultipleChoiceContent, id: 1n, kind: "multipleChoice" },
      { content: { text: "Hello", title: "Intro", variant: "text" }, id: 2n, kind: "static" },
    ];

    const results = validateAnswers(steps, {
      "1": { kind: "multipleChoice", selectedIndex: 0 },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.stepId).toBe(1n);
  });

  test("validates vocabulary answer against word ID", () => {
    const steps = [
      {
        content: {},
        id: 4n,
        kind: "vocabulary",
        word: { id: 100n },
      },
    ];

    const results = validateAnswers(steps, {
      "4": { kind: "vocabulary", selectedWordId: "100" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBeTruthy();
  });

  test("vocabulary answer with wrong word ID is incorrect", () => {
    const steps = [
      {
        content: {},
        id: 4n,
        kind: "vocabulary",
        word: { id: 100n },
      },
    ];

    const results = validateAnswers(steps, {
      "4": { kind: "vocabulary", selectedWordId: "999" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBeFalsy();
  });

  test("validates reading answer against sentence words", () => {
    const steps = [
      {
        content: {},
        id: 5n,
        kind: "reading",
        sentence: { id: 1n, sentence: "hello world", translation: "olá mundo" },
      },
    ];

    const results = validateAnswers(steps, {
      "5": { arrangedWords: ["hello", "world"], kind: "reading" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBeTruthy();
  });

  test("validates listening answer against translation words", () => {
    const steps = [
      {
        content: {},
        id: 6n,
        kind: "listening",
        sentence: { id: 1n, sentence: "hello world", translation: "olá mundo" },
      },
    ];

    const results = validateAnswers(steps, {
      "6": { arrangedWords: ["olá", "mundo"], kind: "listening" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBeTruthy();
  });

  test("skips unsupported step kinds", () => {
    const steps = [{ content: {}, id: 7n, kind: "unknownKind" }];

    const results = validateAnswers(steps, {
      "7": { kind: "multipleChoice", selectedIndex: 0 },
    });

    expect(results).toHaveLength(0);
  });
});
