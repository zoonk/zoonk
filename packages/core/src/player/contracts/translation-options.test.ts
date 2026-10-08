import { describe, expect, it, vi } from "vitest";
import {
  type DistractorWord,
  buildDistractorWordLookup,
  buildTranslationOptions,
} from "./translation-options";

vi.mock("@zoonk/utils/shuffle", () => ({ shuffle: <T>(items: T[]) => items }));

function makeDistractorWord(overrides: Partial<DistractorWord> = {}): DistractorWord {
  return { audioUrl: null, id: "distractor-1", romanization: null, word: "café", ...overrides };
}

describe(buildTranslationOptions, () => {
  it("hydrates distractors with the same normalized key used during sanitation", () => {
    const distractorLookup = buildDistractorWordLookup([
      makeDistractorWord({ audioUrl: "/audio/cafe.mp3", romanization: "cafe", word: "café" }),
    ]);

    const options = buildTranslationOptions({
      distractorLookup,
      kind: "translation",
      word: {
        audioUrl: "/audio/tea.mp3",
        distractors: ["cafe!"],
        id: "word-1",
        romanization: null,
        translation: "tea",
        word: "tea",
      },
    });

    // Tiles carry no respelling, and no romanization for words in Latin letters.
    expect(options).toStrictEqual([
      { audioUrl: "/audio/tea.mp3", id: "word-1", romanization: null, word: "Tea" },
      { audioUrl: "/audio/cafe.mp3", id: "distractor-1", romanization: null, word: "Café" },
    ]);
  });
});
