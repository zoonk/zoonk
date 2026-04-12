import { describe, expect, test, vi } from "vitest";
import {
  type DistractorWord,
  buildDistractorWordLookup,
  buildTranslationOptions,
} from "./translation-options";

vi.mock("@zoonk/utils/shuffle", () => ({
  shuffle: <T>(items: T[]) => items,
}));

function makeDistractorWord(overrides: Partial<DistractorWord> = {}): DistractorWord {
  return {
    audioUrl: null,
    id: "distractor-1",
    pronunciation: null,
    romanization: null,
    word: "café",
    ...overrides,
  };
}

describe(buildTranslationOptions, () => {
  test("hydrates distractors with the same normalized key used during sanitation", () => {
    const distractorLookup = buildDistractorWordLookup([
      makeDistractorWord({
        audioUrl: "/audio/cafe.mp3",
        pronunciation: "ka-fe",
        romanization: "cafe",
        word: "café",
      }),
    ]);

    const options = buildTranslationOptions({
      distractorLookup,
      kind: "translation",
      word: {
        audioUrl: "/audio/tea.mp3",
        distractors: ["cafe!"],
        id: "word-1",
        pronunciation: "tea-pron",
        romanization: null,
        word: "tea",
      },
    });

    expect(options).toEqual([
      {
        audioUrl: "/audio/tea.mp3",
        id: "word-1",
        pronunciation: "tea-pron",
        romanization: null,
        word: "tea",
      },
      {
        audioUrl: "/audio/cafe.mp3",
        id: "distractor-1",
        pronunciation: "ka-fe",
        romanization: "cafe",
        word: "café",
      },
    ]);
  });
});
