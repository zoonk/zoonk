import { describe, expect, test } from "vitest";
import { getActivityCompletionStep, getFirstGeneratedActivityCompletionStep } from "./config";

describe(getActivityCompletionStep, () => {
  test("returns grammar completion step for grammar activity kind", () => {
    expect(getActivityCompletionStep("grammar")).toBe("setGrammarAsCompleted");
  });

  test("returns reading completion step for reading activity kind", () => {
    expect(getActivityCompletionStep("reading")).toBe("setReadingAsCompleted");
  });

  test("returns listening completion step for listening activity kind", () => {
    expect(getActivityCompletionStep("listening")).toBe("setListeningAsCompleted");
  });
});

describe(getFirstGeneratedActivityCompletionStep, () => {
  test("waits for vocabulary completion in language lessons", () => {
    expect(getFirstGeneratedActivityCompletionStep("es")).toBe("setVocabularyAsCompleted");
  });

  test("uses the generic activity completion step for non-language lessons", () => {
    expect(getFirstGeneratedActivityCompletionStep(null)).toBe("setActivityAsCompleted");
  });
});
