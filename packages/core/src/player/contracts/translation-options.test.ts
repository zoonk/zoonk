import { shuffle } from "@zoonk/utils/shuffle";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type DistractorWord,
  buildDistractorWordLookup,
  buildTranslationOptions,
} from "./translation-options";

function makeDistractorWord(overrides: Partial<DistractorWord> = {}): DistractorWord {
  return { audioUrl: null, id: "distractor-1", romanization: null, word: "café", ...overrides };
}

describe(buildTranslationOptions, () => {
  beforeEach(() => {
    vi.mocked(shuffle).mockImplementation((items) => [...items]);
  });

  it("hydrates distractors with the same normalized key used during sanitation", () => {
    const distractorLookup = buildDistractorWordLookup([
      makeDistractorWord({ audioUrl: "/audio/cafe.mp3", romanization: "cafe", word: "café" }),
    ]);

    const options = buildTranslationOptions({
      distractorLookup,
      kind: "translation",
      language: "en",
      word: {
        audioUrl: "/audio/tea.mp3",
        distractors: ["cafe!"],
        id: "word-1",
        romanization: null,
        translation: "tea",
        word: "tea",
      },
    });

    expect(options).toStrictEqual([
      { audioUrl: "/audio/tea.mp3", id: "word-1", romanization: null, word: "Tea" },
      { audioUrl: "/audio/cafe.mp3", id: "distractor-1", romanization: null, word: "Café" },
    ]);
  });

  it("capitalizes options with the rules of their language", () => {
    const options = buildTranslationOptions({
      distractorLookup: new Map(),
      kind: "translation",
      language: "tr",
      word: {
        audioUrl: null,
        distractors: ["inek"],
        id: "word-1",
        romanization: null,
        translation: "island",
        word: "ada",
      },
    });

    expect(options.map((option) => option.word)).toStrictEqual(["Ada", "İnek"]);
  });
});
