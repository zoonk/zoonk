import { describe, expect, test } from "vitest";
import { buildActivityPlayerModel } from "./activity-player-model";

describe(buildActivityPlayerModel, () => {
  test("returns an activity milestone when another activity exists in the same lesson", () => {
    const model = buildActivityPlayerModel({
      brandSlug: "brand",
      chapterSlug: "chapter-1",
      courseSlug: "course",
      lessonSlug: "lesson-1",
      nextActivity: {
        activityPosition: 2,
        chapterSlug: "chapter-1",
        lessonSlug: "lesson-1",
        lessonTitle: "Lesson 1",
      },
      nextSibling: null,
    });

    expect(model.milestone).toEqual({ kind: "activity" });
    expect(model.navigation.nextActivityHref).toBe("/b/brand/c/course/ch/chapter-1/l/lesson-1/a/2");
    expect(model.onNextHref).toBe("/b/brand/c/course/ch/chapter-1/l/lesson-1/a/2");
  });

  test("returns a lesson milestone when the next lesson is in the same chapter", () => {
    const model = buildActivityPlayerModel({
      brandSlug: "brand",
      chapterSlug: "chapter-1",
      courseSlug: "course",
      lessonSlug: "lesson-1",
      nextActivity: {
        activityPosition: 1,
        chapterSlug: "chapter-1",
        lessonSlug: "lesson-2",
        lessonTitle: "Lesson 2",
      },
      nextSibling: null,
    });

    expect(model.milestone).toEqual({
      kind: "lesson",
      nextHref: "/b/brand/c/course/ch/chapter-1/l/lesson-2",
      reviewHref: "/b/brand/c/course/ch/chapter-1/l/lesson-1",
    });
    expect(model.onNextHref).toBe("/b/brand/c/course/ch/chapter-1/l/lesson-2/a/1");
  });

  test("returns a chapter milestone when the next lesson is in another chapter", () => {
    const model = buildActivityPlayerModel({
      brandSlug: "brand",
      chapterSlug: "chapter-1",
      courseSlug: "course",
      lessonSlug: "lesson-1",
      nextActivity: {
        activityPosition: 1,
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
    expect(model.onNextHref).toBe("/b/brand/c/course/ch/chapter-2/l/lesson-2/a/1");
  });

  test("returns a course milestone when there is no next activity or sibling", () => {
    const model = buildActivityPlayerModel({
      brandSlug: "brand",
      chapterSlug: "chapter-1",
      courseSlug: "course",
      lessonSlug: "lesson-1",
      nextActivity: null,
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
