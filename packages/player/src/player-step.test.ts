import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { describe, expect, it } from "vitest";
import { getPlayerStepAudioUrl } from "./player-step";

function buildStep(overrides: Partial<SerializedStep> = {}): SerializedStep {
  return {
    content: {
      options: [{ feedback: "Correct", id: "A", isCorrect: true, text: "A" }],
      question: "Choose",
    },
    fillBlankOptions: [],
    id: "step-1",
    kind: "multipleChoice",
    matchColumnsRightItems: [],
    position: 0,
    sentence: null,
    sentenceWordOptions: [],
    translationOptions: [],
    vocabularyOptions: [],
    word: null,
    wordBankOptions: [],
    ...overrides,
  };
}

describe(getPlayerStepAudioUrl, () => {
  it("returns the prompt audio of letters, words and sentences to hear", () => {
    const alphabet = buildStep({
      content: {
        audioText: "a",
        audioUrl: "https://example.com/a.mp3",
        forms: [],
        pronunciation: "ah",
        readingAid: "a",
        symbol: "a",
      },
      kind: "alphabet",
    });

    expect(getPlayerStepAudioUrl(alphabet)).toBe("https://example.com/a.mp3");
    expect(getPlayerStepAudioUrl(buildStep())).toBeNull();
  });
});
