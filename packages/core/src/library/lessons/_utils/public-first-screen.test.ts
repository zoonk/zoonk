import { describe, expect, it } from "vitest";
import { toPublicFirstScreen } from "./public-first-screen";

const guessHook = {
  options: [
    { id: "planet", isCorrect: false, text: "Yes, like a tiny planet" },
    { id: "cloud", isCorrect: true, text: "No, it's more like a cloud" },
  ],
  question: "Does the electron circle the nucleus like Earth circles the Sun?",
  reveal: "It spreads out into a cloud of places where it could be.",
  variant: "guess",
};

const check = {
  context: "An atom is **mostly empty** space.",
  options: [
    { id: "a", isCorrect: true, reason: "Right: the nucleus is tiny.", text: "Empty space" },
    { id: "b", isCorrect: false, reason: "The nucleus is tiny.", text: "The nucleus" },
  ],
  question: "What takes up most of an atom?",
};

describe(toPublicFirstScreen, () => {
  it("keeps a guess's question and option texts, without the answer or the reveal", () => {
    const screen = toPublicFirstScreen({ content: guessHook, kind: "hook" });

    expect(screen).toStrictEqual({
      context: null,
      guess: true,
      kind: "choice",
      options: [
        { id: "planet", text: "Yes, like a tiny planet" },
        { id: "cloud", text: "No, it's more like a cloud" },
      ],
      question: guessHook.question,
    });

    expect(JSON.stringify(screen)).not.toContain(guessHook.reveal);
  });

  it("keeps a check's question, context and option texts, without reasons", () => {
    const screen = toPublicFirstScreen({ content: check, kind: "check" });

    expect(screen).toStrictEqual({
      context: "An atom is mostly empty space.",
      guess: false,
      kind: "choice",
      options: [
        { id: "a", text: "Empty space" },
        { id: "b", text: "The nucleus" },
      ],
      question: check.question,
    });

    expect(JSON.stringify(screen)).not.toMatch(/isCorrect|reason|Right: the nucleus/u);
  });

  it("shows a text hook as plain prose", () => {
    expect(
      toPublicFirstScreen({
        content: { text: "Atoms are **99.9%** empty.", variant: "text" },
        kind: "hook",
      }),
    ).toStrictEqual({ kind: "text", text: "Atoms are 99.9% empty." });
  });

  it("offers a start button for any other first screen", () => {
    expect(
      toPublicFirstScreen({ content: { text: "An explanation" }, kind: "explanation" }),
    ).toStrictEqual({ kind: "start" });
  });

  it("offers a start button when stored content doesn't match its kind", () => {
    expect(toPublicFirstScreen({ content: { question: "?" }, kind: "check" })).toStrictEqual({
      kind: "start",
    });
  });
});

function textHook(text: string) {
  return toPublicFirstScreen({ content: { text, variant: "text" }, kind: "hook" });
}

describe("text hooks shown as plain prose", () => {
  it("removes emphasis, code and math markers and keeps their content", () => {
    expect(textHook("A *very* **big** `atom` has $E = mc^2$ energy.")).toStrictEqual({
      kind: "text",
      text: "A very big atom has E = mc^2 energy.",
    });
  });

  it("keeps asterisks used as multiplication", () => {
    expect(textHook("2 * 3 * 4 = 24")).toStrictEqual({ kind: "text", text: "2 * 3 * 4 = 24" });
  });
});
