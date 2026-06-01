import { describe, expect, it } from "vitest";
import {
  getClearedHiddenLessonKinds,
  getFilterableLessonKinds,
  getHiddenLessonKindsForFilter,
  getHiddenLessonKindsFromPreferences,
  getNextHiddenLessonKinds,
  getUpdatedLessonFilterSettings,
} from "./lesson-kind-filters";

describe(getHiddenLessonKindsFromPreferences, () => {
  it("keeps only supported hidden lesson kinds in canonical order", () => {
    const result = getHiddenLessonKindsFromPreferences({
      hiddenLessonKinds: ["quiz", "unknown", "explanation", "quiz", 42],
    });

    expect(result).toStrictEqual(["explanation", "quiz"]);
  });

  it("ignores malformed preferences", () => {
    expect(getHiddenLessonKindsFromPreferences(null)).toStrictEqual([]);
    expect(getHiddenLessonKindsFromPreferences({ hiddenLessonKinds: "quiz" })).toStrictEqual([]);
  });
});

describe(getNextHiddenLessonKinds, () => {
  it("adds or removes one hidden lesson kind without duplicating values", () => {
    expect(
      getNextHiddenLessonKinds({
        currentHiddenLessonKinds: ["quiz", "quiz"],
        isHidden: true,
        kind: "explanation",
      }),
    ).toStrictEqual(["explanation", "quiz"]);

    expect(
      getNextHiddenLessonKinds({
        currentHiddenLessonKinds: ["explanation", "quiz"],
        isHidden: false,
        kind: "quiz",
      }),
    ).toStrictEqual(["explanation"]);
  });
});

describe(getFilterableLessonKinds, () => {
  it("shows only present language lesson kinds for language courses", () => {
    const filterableKinds = getFilterableLessonKinds({
      isLanguageCourse: true,
      lessonKinds: ["vocabulary", "grammar", "quiz", "explanation"],
    });

    expect(filterableKinds).toStrictEqual(["grammar", "vocabulary"]);
  });

  it("shows only present content lesson kinds for non-language courses", () => {
    const filterableKinds = getFilterableLessonKinds({
      isLanguageCourse: false,
      lessonKinds: ["vocabulary", "grammar", "quiz", "explanation"],
    });

    expect(filterableKinds).toStrictEqual(["explanation", "quiz"]);
  });
});

describe(getHiddenLessonKindsForFilter, () => {
  it("returns only hidden kinds that apply to the current filter menu", () => {
    const hiddenKinds = getHiddenLessonKindsForFilter({
      filterableLessonKinds: ["grammar", "vocabulary"],
      hiddenLessonKinds: ["quiz", "vocabulary"],
    });

    expect(hiddenKinds).toStrictEqual(["vocabulary"]);
  });
});

describe(getClearedHiddenLessonKinds, () => {
  it("clears only the hidden kinds controlled by the current menu", () => {
    const hiddenKinds = getClearedHiddenLessonKinds({
      currentHiddenLessonKinds: ["quiz", "vocabulary"],
      filterableLessonKinds: ["grammar", "vocabulary"],
    });

    expect(hiddenKinds).toStrictEqual(["quiz"]);
  });
});

describe(getUpdatedLessonFilterSettings, () => {
  it("preserves unrelated user preferences while replacing hidden lesson kinds", () => {
    const result = getUpdatedLessonFilterSettings({
      hiddenLessonKinds: ["quiz"],
      preferences: { existing: "value" },
    });

    expect(result).toStrictEqual({ existing: "value", hiddenLessonKinds: ["quiz"] });
  });
});
