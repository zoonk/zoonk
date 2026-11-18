import { type MockDraft } from "@zoonk/core/exams/mocks/view-contract";
import { describe, expect, it } from "vitest";
import { isCountedMockAnswer } from "./mock-answer-progress";

const draft: MockDraft = {
  answer: { selectedIndex: 1 },
  durationMs: 0,
  flagged: false,
  itemId: "question",
};

describe(isCountedMockAnswer, () => {
  it("counts a nonempty draft while its save is in flight", () => {
    expect(isCountedMockAnswer({ draft })).toBe(true);
  });

  it("stops counting a failed answer while keeping its draft", () => {
    expect(isCountedMockAnswer({ draft, failed: { ...draft, flagged: true } })).toBe(false);
  });

  it("counts a new answer while an older version has failed", () => {
    const failed = { ...draft, answer: { selectedIndex: 0 } };
    expect(isCountedMockAnswer({ draft, failed })).toBe(true);
  });

  it("keeps counting a saved answer if its flag or time fails to save", () => {
    const failed = { ...draft, flagged: true };
    expect(isCountedMockAnswer({ draft: failed, failed, saved: draft })).toBe(true);
  });

  it("leaves an empty answer blank", () => {
    expect(isCountedMockAnswer({ draft: { ...draft, answer: { text: " " } } })).toBe(false);
  });
});
