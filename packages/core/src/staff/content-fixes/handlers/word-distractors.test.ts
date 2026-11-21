import { describe, expect, it } from "vitest";
import { wordDistractorProblem } from "./word-distractors";

const words = [
  { translation: "ghost", word: "ma" },
  { translation: "mom", word: "má" },
];

describe(wordDistractorProblem, () => {
  it("names distractors that are the lesson's translations", () => {
    expect(wordDistractorProblem({ distractors: ["Ghost", "mả", "mom."], words })).toStrictEqual(
      expect.stringContaining('"Ghost", "mom."'),
    );
  });

  it("accepts words in the word's language, other tones and lesson words included", () => {
    expect(wordDistractorProblem({ distractors: ["ma", "mả", "mã", "mạ"], words })).toBeNull();
  });

  it("accepts a translation that is also a lesson word", () => {
    expect(
      wordDistractorProblem({
        distractors: ["hotel"],
        words: [
          { translation: "hotel", word: "hotel" },
          { translation: "hostel", word: "hostal" },
        ],
      }),
    ).toBeNull();
  });
});
