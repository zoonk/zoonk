import { describe, expect, it } from "vitest";
import { getReviewedOptions } from "./review-options";

describe(getReviewedOptions, () => {
  it("shows a right pick alone, as the learner's answer", () => {
    expect(
      getReviewedOptions({
        correctAnswer: { selectedIndex: 1 },
        given: { selectedIndex: 1 },
        isCorrect: true,
        optionCount: 4,
      }),
    ).toStrictEqual([{ index: 1, picked: true, result: "right" }]);
  });

  it("shows a wrong pick beside the right option, in the options' order", () => {
    expect(
      getReviewedOptions({
        correctAnswer: { selectedIndex: 1 },
        given: { selectedIndex: 3 },
        isCorrect: false,
        optionCount: 4,
      }),
    ).toStrictEqual([
      { index: 1, picked: false, result: "right" },
      { index: 3, picked: true, result: "wrong" },
    ]);
  });

  it("shows only the right option when a wrong pick isn't known, and a right one as the pick", () => {
    expect(
      getReviewedOptions({
        correctAnswer: { selectedIndex: 2 },
        given: null,
        isCorrect: false,
        optionCount: 4,
      }),
    ).toStrictEqual([{ index: 2, picked: false, result: "right" }]);

    expect(
      getReviewedOptions({
        correctAnswer: { selectedIndex: 2 },
        given: null,
        isCorrect: true,
        optionCount: 4,
      }),
    ).toStrictEqual([{ index: 2, picked: true, result: "right" }]);
  });

  it("reads a statement's true as the first option and false as the second", () => {
    expect(
      getReviewedOptions({
        correctAnswer: { isTrue: false },
        given: { isTrue: true },
        isCorrect: false,
        optionCount: 2,
      }),
    ).toStrictEqual([
      { index: 0, picked: true, result: "wrong" },
      { index: 1, picked: false, result: "right" },
    ]);
  });

  it("marks every right option of a question that takes several", () => {
    expect(
      getReviewedOptions({
        correctAnswer: { selectedIndexes: [0, 2] },
        given: null,
        isCorrect: true,
        optionCount: 3,
      }),
    ).toStrictEqual([
      { index: 0, picked: true, result: "right" },
      { index: 2, picked: true, result: "right" },
    ]);
  });

  it("has no options for an answer given as a number or typed words", () => {
    expect(
      getReviewedOptions({
        correctAnswer: { number: 68 },
        given: { number: 65 },
        isCorrect: false,
        optionCount: 0,
      }),
    ).toBeNull();
  });
});
