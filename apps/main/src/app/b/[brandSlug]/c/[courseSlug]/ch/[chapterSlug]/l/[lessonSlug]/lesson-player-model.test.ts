import { describe, expect, it } from "vitest";
import { buildLessonPlayerModel } from "./lesson-player-model";

describe(buildLessonPlayerModel, () => {
  it("returns no milestone when another lesson exists in the same chapter", () => {
    const model = buildLessonPlayerModel({
      brandSlug: "brand",
      chapterSlug: "chapter-1",
      courseSlug: "course",
      nextLesson: { chapterSlug: "chapter-1", lessonSlug: "lesson-1", lessonTitle: "Lesson 1" },
      nextSibling: null,
    });

    expect(model.milestone).toBeNull();
    expect(model.navigation.nextLessonHref).toBe("/b/brand/c/course/ch/chapter-1/l/lesson-1");
    expect(model.onNextHref).toBe("/b/brand/c/course/ch/chapter-1/l/lesson-1");
  });

  it("returns no milestone when the next lesson is in the same chapter", () => {
    const model = buildLessonPlayerModel({
      brandSlug: "brand",
      chapterSlug: "chapter-1",
      courseSlug: "course",
      nextLesson: { chapterSlug: "chapter-1", lessonSlug: "lesson-2", lessonTitle: "Lesson 2" },
      nextSibling: null,
    });

    expect(model.milestone).toBeNull();
    expect(model.navigation.chapterHref).toBe("/b/brand/c/course/ch/chapter-1");
    expect(model.onNextHref).toBe("/b/brand/c/course/ch/chapter-1/l/lesson-2");
  });

  it("uses the player route for pending next siblings", () => {
    const model = buildLessonPlayerModel({
      brandSlug: "brand",
      chapterSlug: "chapter-1",
      courseSlug: "course",
      nextLesson: null,
      nextSibling: {
        brandSlug: "brand",
        chapterSlug: "chapter-1",
        courseSlug: "course",
        lessonSlug: "pending-lesson",
        lessonTitle: "Pending Lesson",
      },
    });

    expect(model.milestone).toBeNull();
    expect(model.onNextHref).toBe("/b/brand/c/course/ch/chapter-1/l/pending-lesson");
  });

  it("returns a chapter milestone when the next lesson is in another chapter", () => {
    const model = buildLessonPlayerModel({
      brandSlug: "brand",
      chapterSlug: "chapter-1",
      courseSlug: "course",
      nextLesson: { chapterSlug: "chapter-2", lessonSlug: "lesson-2", lessonTitle: "Lesson 2" },
      nextSibling: null,
    });

    expect(model.milestone).toStrictEqual({
      kind: "chapter",
      nextHref: "/b/brand/c/course/ch/chapter-2",
      reviewHref: "/b/brand/c/course/ch/chapter-1",
    });
    expect(model.onNextHref).toBe("/b/brand/c/course/ch/chapter-2/l/lesson-2");
  });

  it("returns a course milestone when there is no next lesson or sibling", () => {
    const model = buildLessonPlayerModel({
      brandSlug: "brand",
      chapterSlug: "chapter-1",
      courseSlug: "course",
      nextLesson: null,
      nextSibling: null,
    });

    expect(model.milestone).toStrictEqual({
      kind: "course",
      reviewHref: "/b/brand/c/course",
      secondaryReviewHref: "/b/brand/c/course/ch/chapter-1",
    });
    expect(model.onNextHref).toBe(null);
  });
});
