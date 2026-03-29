import { describe, expect, test } from "vitest";
import { getAIResultErrorReason } from "./stream-status";

describe(getAIResultErrorReason, () => {
  test("returns 'aiGenerationFailed' when error is present", () => {
    expect(getAIResultErrorReason({ error: new Error("AI failed"), result: null })).toBe(
      "aiGenerationFailed",
    );
  });

  test("returns 'aiGenerationFailed' when error is present even with a valid result", () => {
    expect(getAIResultErrorReason({ error: new Error("AI failed"), result: { data: "ok" } })).toBe(
      "aiGenerationFailed",
    );
  });

  test("returns 'aiEmptyResult' when result is null", () => {
    expect(getAIResultErrorReason({ error: null, result: null })).toBe("aiEmptyResult");
  });

  test("returns 'aiEmptyResult' when called with no arguments", () => {
    expect(getAIResultErrorReason()).toBe("aiEmptyResult");
  });

  test("returns 'contentValidationFailed' when error is absent and result is present", () => {
    expect(getAIResultErrorReason({ error: null, result: { data: "ok" } })).toBe(
      "contentValidationFailed",
    );
  });
});
