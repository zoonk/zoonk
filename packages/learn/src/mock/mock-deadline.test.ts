import { describe, expect, it } from "vitest";
import { isSavedQuestionExpired } from "./mock-deadline";

describe(isSavedQuestionExpired, () => {
  it("keeps a resumed question closed once its own saved time consumes the limit", () => {
    const drafts = [
      { durationMs: 3000, itemId: "last" },
      { durationMs: 20_000, itemId: "other" },
    ];

    expect(isSavedQuestionExpired({ drafts, itemId: "last", seconds: 3 })).toBe(true);
    expect(isSavedQuestionExpired({ drafts, itemId: "last", seconds: 4 })).toBe(false);
    expect(isSavedQuestionExpired({ drafts, itemId: "missing", seconds: 3 })).toBe(false);
  });

  it("does not close questions without a clock or a running question", () => {
    const drafts = [{ durationMs: 20_000, itemId: "last" }];
    expect(isSavedQuestionExpired({ drafts, itemId: "last", seconds: null })).toBe(false);
    expect(isSavedQuestionExpired({ drafts, seconds: 3 })).toBe(false);
  });
});
