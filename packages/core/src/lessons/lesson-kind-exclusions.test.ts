import { describe, expect, it } from "vitest";
import { getLessonKindExclusionCacheArgs } from "./lesson-kind-exclusions";

describe(getLessonKindExclusionCacheArgs, () => {
  it("deduplicates and sorts hidden lesson kinds for primitive cache keys", () => {
    const result = getLessonKindExclusionCacheArgs({
      excludedLessonKinds: ["quiz", "explanation", "quiz"],
    });

    expect(result).toStrictEqual(["explanation", "quiz"]);
  });

  it("returns an empty key when no lesson kinds are hidden", () => {
    expect(getLessonKindExclusionCacheArgs({})).toStrictEqual([]);
  });
});
