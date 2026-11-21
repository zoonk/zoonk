import { describe, expect, it } from "vitest";
import { translationDistractorEffects } from "./word-distractors";

const wordId = "0193cfe6-604d-7fb2-ad00-f968c7542841";

const words = [
  { translation: "ghost", word: "ma" },
  { translation: "mom", word: "má" },
];

describe(translationDistractorEffects, () => {
  it("flags distractors that are the lesson's translations", () => {
    expect(
      translationDistractorEffects({ distractors: ["Ghost", "mả", "mom."], wordId, words }),
    ).toStrictEqual([{ kind: "distractorsLikeTranslations", texts: ["Ghost", "mom."], wordId }]);
  });

  it("leaves words in the word's language alone, other tones and lesson words included", () => {
    expect(
      translationDistractorEffects({ distractors: ["ma", "mả", "mã", "mạ"], wordId, words }),
    ).toStrictEqual([]);
  });

  it("leaves a translation that is also a lesson word alone", () => {
    expect(
      translationDistractorEffects({
        distractors: ["hotel"],
        wordId,
        words: [
          { translation: "hotel", word: "hotel" },
          { translation: "hostel", word: "hostal" },
        ],
      }),
    ).toStrictEqual([]);
  });
});
