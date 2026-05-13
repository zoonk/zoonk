import { describe, expect, it } from "vitest";
import { validateAnswers } from "./validate-answers";

const multipleChoiceContent = {
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
  it("validates correct multipleChoice answer server-side", () => {
    const steps = [{ content: multipleChoiceContent, id: "1", kind: "multipleChoice" }] as const;

    const results = validateAnswers(steps, {
      "1": { kind: "multipleChoice", selectedOptionId: "option-a" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(true);
    expect(results[0]?.stepId).toBe("1");
  });

  it("validates incorrect multipleChoice answer", () => {
    const steps = [{ content: multipleChoiceContent, id: "1", kind: "multipleChoice" }] as const;

    const results = validateAnswers(steps, {
      "1": { kind: "multipleChoice", selectedOptionId: "option-b" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(false);
  });

  it("validates fillBlank answer", () => {
    const steps = [{ content: fillBlankContent, id: "2", kind: "fillBlank" }] as const;

    const results = validateAnswers(steps, { "2": { kind: "fillBlank", userAnswers: ["dog"] } });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(false);
  });

  it("skips steps with no client answer", () => {
    const steps = [
      { content: multipleChoiceContent, id: "1", kind: "multipleChoice" },
      { content: { text: "Hello", title: "Intro", variant: "text" }, id: "2", kind: "static" },
    ] as const;

    const results = validateAnswers(steps, {
      "1": { kind: "multipleChoice", selectedOptionId: "option-a" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.stepId).toBe("1");
  });

  it("validates translation answer against word ID", () => {
    const steps = [{ content: {}, id: "4", kind: "translation", word: { id: "100" } }] as const;

    const results = validateAnswers(steps, {
      "4": { kind: "translation", selectedOptionId: "100" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(true);
  });

  it("translation answer with wrong word ID is incorrect", () => {
    const steps = [{ content: {}, id: "4", kind: "translation", word: { id: "100" } }] as const;

    const results = validateAnswers(steps, {
      "4": { kind: "translation", selectedOptionId: "999" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(false);
  });

  it("validates reading answer against sentence words", () => {
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
    ] as const;

    const results = validateAnswers(steps, {
      "5": { arrangedWords: ["hello", "world"], kind: "reading" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(true);
  });

  it("validates listening answer against translation words", () => {
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
    ] as const;

    const results = validateAnswers(steps, {
      "6": { arrangedWords: ["olá", "mundo"], kind: "listening" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(true);
  });

  it("rejects non-canonical reading answers", () => {
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
    ] as const;

    const results = validateAnswers(steps, {
      "7": { arrangedWords: ["guten", "morgen", "lara"], kind: "reading" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(false);
  });

  it("rejects non-canonical listening answers", () => {
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
    ] as const;

    const results = validateAnswers(steps, {
      "10": { arrangedWords: ["bom", "dia", "lara"], kind: "listening" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(false);
  });

  it("accepts punctuation-insensitive listening answers", () => {
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
    ] as const;

    const results = validateAnswers(steps, {
      "8": { arrangedWords: ["bom", "dia", "lara"], kind: "listening" },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(true);
  });

  it("skips non-answerable step kinds", () => {
    const steps = [{ content: {}, id: "7", kind: "visual" }] as const;

    const results = validateAnswers(steps, {
      "7": { kind: "multipleChoice", selectedOptionId: "option-a" },
    });

    expect(results).toHaveLength(0);
  });

  it("skips malformed unanswered static steps instead of throwing", () => {
    const steps = [{ content: { text: "Legacy static step" }, id: "16", kind: "static" }] as const;

    const runValidation = () => validateAnswers(steps, {});

    expect(runValidation).not.toThrow();
    expect(runValidation()).toStrictEqual([]);
  });
});
