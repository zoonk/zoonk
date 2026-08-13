import { describe, expect, it } from "vitest";
import { isLessonSeoIndexable } from "./seo";

const indexableLesson = {
  description: "A specific lesson description",
  kind: "explanation",
  slug: "a-specific-lesson-title",
  sourceTitle: null,
  title: "A specific lesson title",
} as const;

describe(isLessonSeoIndexable, () => {
  it("indexes substantive authored lessons, companions, and chapter reviews", () => {
    expect(isLessonSeoIndexable(indexableLesson)).toBe(true);

    expect(
      isLessonSeoIndexable({
        ...indexableLesson,
        description: null,
        kind: "quiz",
        sourceTitle: "A specific lesson title",
        title: null,
      }),
    ).toBe(true);

    expect(
      isLessonSeoIndexable({ ...indexableLesson, description: null, kind: "review", title: null }),
    ).toBe(true);
  });

  it("does not index multi-source lesson kinds without a standalone topic", () => {
    expect(isLessonSeoIndexable({ ...indexableLesson, kind: "reading" })).toBe(false);
    expect(isLessonSeoIndexable({ ...indexableLesson, kind: "listening" })).toBe(false);
  });

  it("does not index split continuations with copied metadata", () => {
    expect(
      isLessonSeoIndexable({
        ...indexableLesson,
        slug: "a-specific-lesson-title--split--019f39b9-ec76-77bc-a559-f0e8a65736d5--2",
      }),
    ).toBe(false);
  });

  it("does not index pages without identifiable metadata", () => {
    expect(isLessonSeoIndexable({ ...indexableLesson, description: null })).toBe(false);
    expect(isLessonSeoIndexable({ ...indexableLesson, title: null })).toBe(false);

    expect(
      isLessonSeoIndexable({
        ...indexableLesson,
        description: null,
        kind: "practice",
        sourceTitle: null,
        title: null,
      }),
    ).toBe(false);
  });
});
