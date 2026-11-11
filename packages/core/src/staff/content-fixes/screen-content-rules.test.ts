import { describe, expect, it } from "vitest";
import { checkScreenContentChange } from "./screen-content-rules";

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
});
