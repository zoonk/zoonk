import { describe, expect, it } from "vitest";
import { checkScreenContentChange, listContentValueChanges } from "./screen-content-rules";

const check = {
  basis: { position: 0, quote: "Two and two make four." },
  options: [
    { id: "a", isCorrect: true, reason: "Two and two make four.", text: "4" },
    { id: "b", isCorrect: false, reason: "That's two and three.", text: "5" },
  ],
  question: "What is 2 + 2?",
};

function withOptions(
  options: { id?: string; isCorrect?: boolean; reason?: string; text?: string }[],
) {
  return {
    ...check,
    options: check.options.map((option, index) => ({ ...option, ...options[index] })),
  };
}

describe(checkScreenContentChange, () => {
  it("lets a fix correct the question learners read while the answer key stays", () => {
    expect(
      checkScreenContentChange({
        after: { ...check, question: "What is 2 plus 2?" },
        before: check,
        kind: "check",
      }),
    ).toStrictEqual({ changesAnswerKey: false, changesQuestion: true, ok: true });
  });

  it("lets a fix move which option is right, with its feedback, while the question stays", () => {
    expect(
      checkScreenContentChange({
        after: withOptions([
          { isCorrect: false, reason: "Count again." },
          { isCorrect: true, reason: "Right." },
        ]),
        before: check,
        kind: "check",
      }),
    ).toStrictEqual({ changesAnswerKey: true, changesQuestion: false, ok: true });
  });

  it("refuses a question and its answer key changed together, which would misgrade a learner on the old screen", () => {
    const verdict = checkScreenContentChange({
      after: {
        ...withOptions([{ isCorrect: false }, { isCorrect: true }]),
        question: "What is 2 + 3?",
      },
      before: check,
      kind: "check",
    });

    expect(verdict).toMatchObject({ ok: false });
  });

  it.each([
    ["an option id", withOptions([{ id: "c" }])],
    ["the options' count", { ...check, options: check.options.slice(0, 1) }],
    ["the basis it quotes", { ...check, basis: { ...check.basis, position: 2 } }],
    ["a field's presence", { ...check, context: "Counting apples." }],
    ["a value's type", { ...check, question: 4 }],
  ])("refuses a change to %s", (_, after) => {
    expect(checkScreenContentChange({ after, before: check, kind: "check" })).toMatchObject({
      ok: false,
    });
  });

  it("refuses a new picture request, which would leave the drawn picture describing something else", () => {
    const before = { image: { alt: "A cell", prompt: "A plant cell" }, text: "Cells have walls." };

    expect(
      checkScreenContentChange({
        after: { ...before, image: { ...before.image, prompt: "An animal cell" } },
        before,
        kind: "explanation",
      }),
    ).toMatchObject({ ok: false, problem: "image.prompt can't change in a fix" });
  });

  it("counts everything on a teaching screen as prose", () => {
    const before = { text: "Water boils at 100 °C at sea level.", title: "Boiling" };

    expect(
      checkScreenContentChange({
        after: { text: "Water boils at 100 °C at sea level.", title: "Boiling point" },
        before,
        kind: "explanation",
      }),
    ).toStrictEqual({ changesAnswerKey: false, changesQuestion: false, ok: true });
  });

  it("treats a typed answer's key points as its answer key", () => {
    const before = {
      basis: null,
      keyPoints: ["Names photosynthesis"],
      question: "How do plants eat?",
      sampleAnswer: "Through photosynthesis.",
    };

    expect(
      checkScreenContentChange({
        after: { ...before, keyPoints: ["Names photosynthesis or making food from light"] },
        before,
        kind: "typedAnswer",
      }),
    ).toStrictEqual({ changesAnswerKey: true, changesQuestion: false, ok: true });

    expect(
      checkScreenContentChange({
        after: { ...before, keyPoints: ["Names respiration"], question: "How do plants breathe?" },
        before,
        kind: "typedAnswer",
      }),
    ).toMatchObject({ ok: false });
  });

  it("reads a blank's sentence as its question and its answers as the key, which may change together", () => {
    const before = {
      answers: ["es"],
      distractors: ["está", "son"],
      feedback: "Ser describes what something is.",
      template: "La casa [BLANK] grande.",
    };

    expect(
      checkScreenContentChange({
        after: { ...before, answers: ["está"], template: "La casa [BLANK] limpia hoy." },
        before,
        kind: "fillBlank",
      }),
    ).toStrictEqual({ changesAnswerKey: true, changesQuestion: true, ok: true });

    expect(
      checkScreenContentChange({
        after: { ...before, feedback: "Ser describes what something is like." },
        before,
        kind: "fillBlank",
      }),
    ).toStrictEqual({ changesAnswerKey: false, changesQuestion: false, ok: true });
  });

  it("reads a match's pairs as its answer key", () => {
    const before = { pairs: [{ left: "perro", right: "dog" }] };

    expect(
      checkScreenContentChange({
        after: { pairs: [{ left: "perro", right: "a dog" }] },
        before,
        kind: "matchColumns",
      }),
    ).toStrictEqual({ changesAnswerKey: true, changesQuestion: false, ok: true });
  });

  it("lets a screen whose question another row decides change both, still refusing structure", () => {
    const after = { ...withOptions([{ text: "6" }, { isCorrect: true }]), question: "2 + 4?" };

    expect(
      checkScreenContentChange({ after, before: check, keyedElsewhere: true, kind: "check" }),
    ).toStrictEqual({ changesAnswerKey: true, changesQuestion: true, ok: true });

    expect(
      checkScreenContentChange({
        after: withOptions([{ id: "c" }]),
        before: check,
        keyedElsewhere: true,
        kind: "check",
      }),
    ).toMatchObject({ ok: false });
  });
});

describe(listContentValueChanges, () => {
  it("lists each changed value with its place and marks the ones that decide the answer", () => {
    expect(
      listContentValueChanges({
        after: withOptions([{ isCorrect: false }, { isCorrect: true, reason: "Two and three." }]),
        before: check,
      }),
    ).toStrictEqual([
      { after: false, before: true, isAnswerKey: true, path: "options.0.isCorrect" },
      { after: true, before: false, isAnswerKey: true, path: "options.1.isCorrect" },
      {
        after: "Two and three.",
        before: "That's two and three.",
        isAnswerKey: false,
        path: "options.1.reason",
      },
    ]);
  });

  it("returns null for versions that don't share a shape", () => {
    expect(listContentValueChanges({ after: { ...check, options: [] }, before: check })).toBeNull();
  });
});
