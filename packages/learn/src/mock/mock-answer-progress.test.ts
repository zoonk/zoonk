import { type MockDraft } from "@zoonk/core/exams/mocks/view-contract";
import { describe, expect, it } from "vitest";
import { countsTowardMockProgress } from "./mock-answer-progress";

const ITEM_ID = "question";

const draft: MockDraft = {
  answer: { selectedIndex: 1 },
  durationMs: 0,
  flagged: false,
  itemId: ITEM_ID,
};

function count({
  active = draft,
  failed,
  saved,
}: { active?: MockDraft; failed?: MockDraft; saved?: MockDraft } = {}): boolean {
  return countsTowardMockProgress(
    {
      drafts: { [ITEM_ID]: active },
      failedDrafts: failed ? { [ITEM_ID]: failed } : {},
      savedDrafts: saved ? { [ITEM_ID]: saved } : {},
    },
    ITEM_ID,
  );
}

describe(countsTowardMockProgress, () => {
  it("counts a nonempty draft while its save is in flight", () => {
    expect(count()).toBe(true);
  });

  it("stops counting a failed answer while keeping its draft", () => {
    expect(count({ failed: { ...draft, flagged: true } })).toBe(false);
  });

  it("counts a new answer while an older version has failed", () => {
    const failed = { ...draft, answer: { selectedIndex: 0 } };
    expect(count({ failed })).toBe(true);
  });

  it("keeps counting a saved answer if its flag or time fails to save", () => {
    const failed = { ...draft, flagged: true };
    expect(count({ active: failed, failed, saved: draft })).toBe(true);
  });

  it("leaves an empty answer blank", () => {
    expect(count({ active: { ...draft, answer: { text: " " } } })).toBe(false);
  });
});
