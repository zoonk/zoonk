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

  test("validates story strong choice as correct", () => {
    const storyContent = {
      choices: [
        {
          alignment: "strong",
          consequence: "Things improve.",
          id: "1a",
          metricEffects: [{ effect: "positive", metric: "Production" }],
          text: "Do the right thing",
        },
        {
          alignment: "weak",
          consequence: "Things get worse.",
          id: "1b",
          metricEffects: [{ effect: "negative", metric: "Production" }],
          text: "Do the wrong thing",
        },
      ],
      situation: "You face a decision.",
    };

    const steps = [{ content: storyContent, id: 8n, kind: "story" }];

    const results = validateAnswers(steps, {
      "8": { kind: "story", selectedChoiceId: "1a", selectedText: "Do the right thing" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(true);
  });

  test("validates story weak choice as incorrect", () => {
    const storyContent = {
      choices: [
        {
          alignment: "strong",
          consequence: "Things improve.",
          id: "1a",
          metricEffects: [{ effect: "positive", metric: "Production" }],
          text: "Do the right thing",
        },
        {
          alignment: "weak",
          consequence: "Things get worse.",
          id: "1b",
          metricEffects: [{ effect: "negative", metric: "Production" }],
          text: "Do the wrong thing",
        },
      ],
      situation: "You face a decision.",
    };

    const steps = [{ content: storyContent, id: 8n, kind: "story" }];

    const results = validateAnswers(steps, {
      "8": { kind: "story", selectedChoiceId: "1b", selectedText: "Do the wrong thing" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(false);
  });

  test("story validator returns empty for wrong answer kind", () => {
    const storyContent = {
      choices: [
        {
          alignment: "strong",
          consequence: "Things improve.",
          id: "1a",
          metricEffects: [{ effect: "positive", metric: "Production" }],
          text: "Do the right thing",
        },
        {
          alignment: "weak",
          consequence: "Things get worse.",
          id: "1b",
          metricEffects: [{ effect: "negative", metric: "Production" }],
          text: "Do the wrong thing",
        },
      ],
      situation: "You face a decision.",
    };

    const steps = [{ content: storyContent, id: 9n, kind: "story" }];

    const results = validateAnswers(steps, {
      "9": { kind: "multipleChoice", selectedIndex: 0, selectedText: "Option A" },
    });

    expect(results).toHaveLength(0);
  });

  test("skips unsupported step kinds", () => {
    const steps = [{ content: {}, id: 7n, kind: "unknownKind" }];

    const results = validateAnswers(steps, {
      "7": { kind: "multipleChoice", selectedIndex: 0, selectedText: "Option A" },
    });

    expect(results).toHaveLength(0);
  });

  test("validates investigation problem as always correct", () => {
    const steps = [
      {
        content: {
          scenario: "test",
          variant: "problem",
          visual: { columns: ["A"], kind: "table", rows: [["1"]] },
        },
        id: 10n,
        kind: "investigation",
      },
    ];

    const results = validateAnswers(steps, {
      "10": { kind: "investigation", variant: "problem" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(true);
  });

  test("validates investigation action as always correct", () => {
    const steps = [
      {
        content: {
          actions: [
            {
              finding: "Logs show memory climbing",
              findingVisual: { columns: ["A"], kind: "table", rows: [["1"]] },
              label: "Check logs",
              quality: "critical",
            },
          ],
          variant: "action",
        },
        id: 11n,
        kind: "investigation",
      },
    ];

    const results = validateAnswers(steps, {
      "11": {
        kind: "investigation",
        selectedActionIndex: 0,
        variant: "action",
      },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(true);
  });

  test("validates investigation call: best accuracy is correct", () => {
    const steps = [
      {
        content: {
          explanations: [
            { accuracy: "best", text: "Memory leak" },
            { accuracy: "wrong", text: "Network failure" },
          ],
          fullExplanation: "The API had a memory leak",
          variant: "call",
        },
        id: 14n,
        kind: "investigation",
      },
    ];

    const results = validateAnswers(steps, {
      "14": { kind: "investigation", selectedExplanationIndex: 0, variant: "call" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(true);
  });

  test("validates investigation call: wrong accuracy is incorrect", () => {
    const steps = [
      {
        content: {
          explanations: [
            { accuracy: "best", text: "Memory leak" },
            { accuracy: "wrong", text: "Network failure" },
          ],
          fullExplanation: "The API had a memory leak",
          variant: "call",
        },
        id: 15n,
        kind: "investigation",
      },
    ];

    const results = validateAnswers(steps, {
      "15": { kind: "investigation", selectedExplanationIndex: 1, variant: "call" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(false);
  });
});
