import { describe, expect, test } from "vitest";
import { getActivityCompletionStep } from "./config";

describe(getActivityCompletionStep, () => {
  test("returns grammar save step for grammar activity kind", () => {
    expect(getActivityCompletionStep("grammar")).toBe("saveGrammarActivity");
  });

  test("returns reading save step for reading activity kind", () => {
    expect(getActivityCompletionStep("reading")).toBe("saveReadingActivity");
  });

  test("returns listening save step for listening activity kind", () => {
    expect(getActivityCompletionStep("listening")).toBe("saveListeningActivity");
  });
});
