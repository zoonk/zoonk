import { describe, expect, test } from "vitest";
import { getActivityCompletionStep } from "./config";

describe(getActivityCompletionStep, () => {
  test("returns grammar completion step for grammar activity kind", () => {
    expect(getActivityCompletionStep("grammar")).toBe("setGrammarAsCompleted");
  });

  test("returns reading completion step for reading activity kind", () => {
    expect(getActivityCompletionStep("reading")).toBe("setReadingAsCompleted");
  });
});
