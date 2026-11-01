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

  it("shows each distractor as written, with its own word's audio", () => {
    const distractorLookup = buildDistractorWordLookup([
      makeDistractorWord({ audioUrl: "/audio/esta-accent.mp3", id: "esta-accent", word: "está" }),
      makeDistractorWord({ audioUrl: "/audio/esta.mp3", id: "esta", word: "esta" }),
    ]);

    const options = buildTranslationOptions({
      distractorLookup,
      kind: "translation",
      language: "es",
      word: {
        audioUrl: "/audio/es.mp3",
        distractors: ["está"],
        id: "word-1",
        romanization: null,
        translation: "is",
        word: "es",
      },
    });

    expect(options).toStrictEqual([
      { audioUrl: "/audio/es.mp3", id: "word-1", romanization: null, word: "Es" },
      { audioUrl: "/audio/esta-accent.mp3", id: "esta-accent", romanization: null, word: "Está" },
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
