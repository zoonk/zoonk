import { describe, expect, it } from "vitest";
import { levelTestAnswerInputSchema } from "./level-test-contract";

describe("a level test answer", () => {
  it("reads an answer left out as I don't know", () => {
    expect(levelTestAnswerInputSchema.parse({ questionId: "reading-A2-0" })).toStrictEqual({
      answerIndex: null,
      questionId: "reading-A2-0",
    });
  });

  it("keeps the option chosen", () => {
    expect(
      levelTestAnswerInputSchema.parse({ answerIndex: 2, questionId: "reading-A2-0" }),
    ).toStrictEqual({ answerIndex: 2, questionId: "reading-A2-0" });
  });
});
