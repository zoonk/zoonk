import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SPLIT_LESSON_SLUG_MARKER, getSplitLessonSlug, isSplitLessonSlug } from "./split-lessons";

describe("split lesson slugs", () => {
  it("creates a reserved deterministic slug for one continuation part", () => {
    const rootLessonId = randomUUID();

    const slug = getSplitLessonSlug({
      partNumber: 2,
      rootLessonId,
      slug: "everyday-cyrillic-words",
    });

    expect(slug).toBe(`everyday-cyrillic-words${SPLIT_LESSON_SLUG_MARKER}${rootLessonId}--2`);
    expect(isSplitLessonSlug(slug)).toBe(true);
  });

  it("does not classify ordinary lesson slugs as continuations", () => {
    expect(isSplitLessonSlug("train-split-validation")).toBe(false);
    expect(isSplitLessonSlug("split-lesson-part-2")).toBe(false);
  });

  it("rejects part numbers reserved for the root lesson", () => {
    expect(() =>
      getSplitLessonSlug({ partNumber: 1, rootLessonId: randomUUID(), slug: "lesson" }),
    ).toThrow("Split lesson part numbers must start at 2");
  });
});
