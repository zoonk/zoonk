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
      { audioUrl: "/audio/es.mp3", id: "word-1", romanization: null, word: "es" },
      { audioUrl: "/audio/esta-accent.mp3", id: "esta-accent", romanization: null, word: "está" },
    ]);
  });

  it.each([
    { distractors: ["trinken", "kochen"], language: "de", word: "essen" },
    { distractors: ["die Kaution", "der Vertrag"], language: "de", word: "die Miete" },
    { distractors: ["er", "es"], language: "de", word: "sie" },
    { distractors: ["du", "ihr"], language: "de", word: "Sie" },
    { distractors: ["the lease", "the mortgage"], language: "en", word: "the rent" },
    { distractors: ["I've seen", "I've lost"], language: "en", word: "I've had" },
    { distractors: ["inek", "ılık"], language: "tr", word: "ada" },
  ])("shows $language option $word in the case it is spelled with", ({ distractors, word }) => {
    const options = buildTranslationOptions({
      distractorLookup: new Map(),
      kind: "translation",
      word: {
        audioUrl: null,
        distractors,
        id: "word-1",
        romanization: null,
        translation: "meaning",
        word,
      },
    });

    expect(options.map((option) => option.word)).toStrictEqual([word, ...distractors]);
  });
});
