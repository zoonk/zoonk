import { describe, expect, it } from "vitest";
import { toNextQuestion } from "./test-question";

describe(toNextQuestion, () => {
  it("names the question an open test asks next", () => {
    expect(toNextQuestion({ answered: 0, total: 8 })).toBe(1);
    expect(toNextQuestion({ answered: 7, total: 8 })).toBe(8);
  });

  it("names none once every question is answered and the test only waits to be closed", () => {
    expect(toNextQuestion({ answered: 8, total: 8 })).toBeNull();
  });
});
