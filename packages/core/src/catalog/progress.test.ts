import { randomUUID } from "node:crypto";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { cacheTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { getUserProgressCacheTag } from "../cache/tags";
import { lessonRunFixture } from "../lesson-player/_test-utils/lesson-run-fixture";
import { getCatalogChapterProgress, getCatalogCourseProgress } from "./progress";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

describe(getCatalogCourseProgress, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("counts finished lessons per chapter from the learner's ledger", async () => {
    const [learner, other, { chapters, course, lessons }] = await Promise.all([
      userFixture(),
      userFixture(),
      catalogCourseFixture({ lessonCounts: [2, 2] }),
    ]);

    await Promise.all([
      learningEventFixture({ contentIds: { lessonId: lessons[0]![0]!.id }, userId: learner.id }),
      learningEventFixture({
        contentIds: { lessonId: lessons[0]![1]!.id },
        kind: "review",
        userId: learner.id,
      }),
      lessonRunFixture({ lessonId: lessons[1]![0]!.id, userId: learner.id }),
      learningEventFixture({ contentIds: { lessonId: lessons[1]![1]!.id }, userId: other.id }),
    ]);

    mockSession(learner.id);

    await expect(getCatalogCourseProgress({ courseId: course.id })).resolves.toStrictEqual({
      chapters: [
        { chapterId: chapters[0]!.id, completedLessons: 2, totalLessons: 2 },
        { chapterId: chapters[1]!.id, completedLessons: 0, totalLessons: 2 },
      ],
      percentComplete: 50,
    });

    expect(vi.mocked(cacheTag).mock.calls.flat()).toContain(getUserProgressCacheTag(learner.id));
  });

  it("estimates the percentage while a chapter's lessons aren't written", async () => {
    const [learner, { course, lessons }] = await Promise.all([
      userFixture(),
      catalogCourseFixture({ lessonCounts: [2] }),
    ]);

    const pending = await libraryChapterFixture({ homeCourseId: course.id });

    await Promise.all([
      courseChapterFixture({ chapterId: pending.id, courseId: course.id, position: 1 }),
      learningEventFixture({ contentIds: { lessonId: lessons[0]![0]!.id }, userId: learner.id }),
      learningEventFixture({ contentIds: { lessonId: lessons[0]![1]!.id }, userId: learner.id }),
    ]);

    mockGuestSession(learner.id);

    await expect(getCatalogCourseProgress({ courseId: course.id })).resolves.toMatchObject({
      chapters: [
        { completedLessons: 2, totalLessons: 2 },
        { chapterId: pending.id, completedLessons: 0, totalLessons: 0 },
      ],
      percentComplete: 50,
    });
  });

  it("has no progress without a session and isn't found outside the catalog", async () => {
    const { course } = await catalogCourseFixture({ lessonCounts: [1] });

    const results = await Promise.all([
      getCatalogCourseProgress({ courseId: course.id }),
      getCatalogCourseProgress({ courseId: randomUUID() }),
    ]);

    expect(results).toStrictEqual([{ chapters: [], percentComplete: null }, null]);
  });
});

describe(getCatalogChapterProgress, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("marks the chapter's finished lessons in order", async () => {
    const [learner, { chapters, lessons }] = await Promise.all([
      userFixture(),
      catalogCourseFixture({ lessonCounts: [3] }),
    ]);

    await learningEventFixture({
      contentIds: { lessonId: lessons[0]![1]!.id },
      userId: learner.id,
    });

    mockSession(learner.id);

    await expect(getCatalogChapterProgress({ chapterId: chapters[0]!.id })).resolves.toStrictEqual({
      lessons: [
        { isCompleted: false, lessonId: lessons[0]![0]!.id },
        { isCompleted: true, lessonId: lessons[0]![1]!.id },
        { isCompleted: false, lessonId: lessons[0]![2]!.id },
      ],
      percentComplete: 33,
    });
  });

  it("hides another learner's private chapter", async () => {
    const [owner, viewer] = await Promise.all([userFixture(), userFixture()]);

    const chapter = await libraryChapterFixture({ ownerId: owner.id, visibility: "private" });

    mockSession(viewer.id);
    await expect(getCatalogChapterProgress({ chapterId: chapter.id })).resolves.toBeNull();

    mockSession(owner.id);

    await expect(getCatalogChapterProgress({ chapterId: chapter.id })).resolves.toStrictEqual({
      lessons: [],
      percentComplete: null,
    });
  });
});
