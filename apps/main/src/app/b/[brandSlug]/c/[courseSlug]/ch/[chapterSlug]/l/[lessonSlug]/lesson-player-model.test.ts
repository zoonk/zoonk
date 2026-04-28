import { describe, expect, test } from "vitest";
import { buildLessonPlayerModel } from "./lesson-player-model";

describe(buildLessonPlayerModel, () => {
  test("returns no milestone when another lesson exists in the same chapter", () => {
    const model = buildLessonPlayerModel({
      brandSlug: "brand",
      chapterSlug: "chapter-1",
      courseSlug: "course",
      nextLesson: {
        chapterSlug: "chapter-1",
        lessonSlug: "lesson-1",
        lessonTitle: "Lesson 1",
      },
      nextSibling: null,
    });

    expect(model.milestone).toBeNull();
    expect(model.navigation.nextLessonHref).toBe("/b/brand/c/course/ch/chapter-1/l/lesson-1");
    expect(model.onNextHref).toBe("/b/brand/c/course/ch/chapter-1/l/lesson-1");
  });

  test("returns no milestone when the next lesson is in the same chapter", () => {
    const model = buildLessonPlayerModel({
      brandSlug: "brand",
      chapterSlug: "chapter-1",
      courseSlug: "course",
      nextLesson: {
        chapterSlug: "chapter-1",
        lessonSlug: "lesson-2",
        lessonTitle: "Lesson 2",
      },
      nextSibling: null,
    });

    expect(model.milestone).toBeNull();
    expect(model.navigation.lessonHref).toBe("/b/brand/c/course/ch/chapter-1");
    expect(model.onNextHref).toBe("/b/brand/c/course/ch/chapter-1/l/lesson-2");
  });

  test("uses the player route for pending next siblings", () => {
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

  test("returns a chapter milestone when the next lesson is in another chapter", () => {
    const model = buildLessonPlayerModel({
      brandSlug: "brand",
      chapterSlug: "chapter-1",
      courseSlug: "course",
      nextLesson: {
        chapterSlug: "chapter-2",
        lessonSlug: "lesson-2",
        lessonTitle: "Lesson 2",
      },
      nextSibling: null,
    });

    expect(model.milestone).toEqual({
      kind: "chapter",
      nextHref: "/b/brand/c/course/ch/chapter-2",
      reviewHref: "/b/brand/c/course/ch/chapter-1",
    });
    expect(model.onNextHref).toBe("/b/brand/c/course/ch/chapter-2/l/lesson-2");
  });

  test("returns a course milestone when there is no next lesson or sibling", () => {
    const model = buildLessonPlayerModel({
      brandSlug: "brand",
      chapterSlug: "chapter-1",
      courseSlug: "course",
      nextLesson: null,
      nextSibling: null,
    });

    expect(model.milestone).toEqual({
      kind: "course",
      reviewHref: "/b/brand/c/course",
      secondaryReviewHref: "/b/brand/c/course/ch/chapter-1",
    });
    expect(model.onNextHref).toBe(null);
  });
});
