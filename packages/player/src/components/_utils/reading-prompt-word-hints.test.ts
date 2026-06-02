import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { describe, expect, it } from "vitest";
import { buildReadingPromptWordHints } from "./reading-prompt-word-hints";

/**
 * Builds the smallest word-option shape needed by prompt hint tests.
 */
function makeOption(overrides: Partial<WordBankOption>): WordBankOption {
  return {
    audioUrl: null,
    pronunciation: null,
    romanization: null,
    translation: null,
    word: "word",
    ...overrides,
  };
}

describe(buildReadingPromptWordHints, () => {
  it("inverts target sentence word translations onto visible prompt words", () => {
    const hints = buildReadingPromptWordHints({
      prompt: "Oi, como você está?",
      sentenceWordOptions: [
        makeOption({ translation: "oi", word: "Hi," }),
        makeOption({ translation: "como", word: "how" }),
        makeOption({ translation: "são", word: "are" }),
        makeOption({ translation: "você", word: "you?" }),
      ],
    });

    expect(hints).toStrictEqual([
      { translation: "Hi", word: "Oi," },
      { translation: "how", word: "como" },
      { translation: "you", word: "você" },
      { translation: "are", word: "está?" },
    ]);
  });

  it("matches prompt words without punctuation or accents", () => {
    const hints = buildReadingPromptWordHints({
      prompt: "Olá!",
      sentenceWordOptions: [makeOption({ translation: "ola", word: "Hello!" })],
    });

    expect(hints).toStrictEqual([{ translation: "Hello", word: "Olá!" }]);
  });

  it("uses each repeated direct match once", () => {
    const hints = buildReadingPromptWordHints({
      prompt: "um um",
      sentenceWordOptions: [
        makeOption({ translation: "um", word: "a" }),
        makeOption({ translation: "um", word: "one" }),
      ],
    });

    expect(hints).toStrictEqual([
      { translation: "a", word: "um" },
      { translation: "one", word: "um" },
    ]);
  });

  it("only falls back to remaining target words after exact matches", () => {
    const hints = buildReadingPromptWordHints({
      prompt: "Tenha um bom dia!",
      sentenceWordOptions: [
        makeOption({ translation: "ter", word: "Have" }),
        makeOption({ translation: "um", word: "a" }),
        makeOption({ translation: "legal", word: "nice" }),
        makeOption({ translation: "dia", word: "day!" }),
      ],
    });

    expect(hints).toStrictEqual([
      { translation: "Have", word: "Tenha" },
      { translation: "a", word: "um" },
      { translation: "nice", word: "bom" },
      { translation: "day", word: "dia!" },
    ]);
  });
});
