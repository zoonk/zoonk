import { describe, expect, it } from "vitest";
import { getResumableAnswers } from "./answer-draft";

const answer = (itemId: string) => ({ itemId });

describe(getResumableAnswers, () => {
  it("goes on from the saved answers to the run's questions, in order", () => {
    expect(
      getResumableAnswers({
        answers: [answer("a"), answer("b")],
        questionIds: ["a", "b", "c", "d"],
        total: 4,
      }),
    ).toStrictEqual([answer("a"), answer("b")]);
  });

  it("drops what no longer fits the questions, from the first that differs", () => {
    expect(
      getResumableAnswers({
        answers: [answer("a"), answer("x"), answer("c")],
        questionIds: ["a", "b", "c"],
        total: 3,
      }),
    ).toStrictEqual([answer("a")]);
  });

  it("asks the last question again instead of finishing on its own", () => {
    expect(
      getResumableAnswers({
        answers: [answer("a"), answer("b"), answer("c")],
        questionIds: ["a", "b", "c"],
        total: 3,
      }),
    ).toStrictEqual([answer("a"), answer("b")]);
  });
});
