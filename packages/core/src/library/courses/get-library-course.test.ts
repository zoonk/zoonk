import { randomUUID } from "node:crypto";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { cacheTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getCourseCurriculumCacheTag, getLibraryChapterCacheTag } from "../../cache/tags";
import { getLibraryCourse } from "./get-library-course";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

describe(getLibraryCourse, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("returns the outline in level bands, chapters and lessons in order", async () => {
    const course = await courseFixture();

    const [overview, advanced, beginnerFirst, beginnerSecond, lesson] = await Promise.all([
      libraryChapterFixture({ level: "overview", title: "Overview" }),
      libraryChapterFixture({ level: "advanced", title: "Advanced" }),
      libraryChapterFixture({ title: "Beginner 1" }),
      libraryChapterFixture({ title: "Beginner 2" }),
      libraryLessonFixture({ title: "First lesson" }),
    ]);

    await Promise.all([
      courseChapterFixture({
        chapterId: advanced.id,
        courseId: course.id,
        level: "advanced",
        position: 0,
      }),
      courseChapterFixture({ chapterId: beginnerSecond.id, courseId: course.id, position: 1 }),
      courseChapterFixture({ chapterId: beginnerFirst.id, courseId: course.id, position: 0 }),
      courseChapterFixture({
        chapterId: overview.id,
        courseId: course.id,
        level: "overview",
        position: 0,
      }),
      chapterLessonFixture({ chapterId: beginnerFirst.id, lessonId: lesson.id, position: 0 }),
    ]);

    const result = await getLibraryCourse({ courseId: course.id });

    expect(
      result?.levels.map((band) => ({
        chapters: band.chapters.map((chapter) => chapter.title),
        level: band.level,
      })),
    ).toStrictEqual([
      { chapters: ["Overview"], level: "overview" },
      { chapters: ["Beginner 1", "Beginner 2"], level: "beginner" },
      { chapters: ["Advanced"], level: "advanced" },
    ]);

    expect(result?.levels[1]?.chapters[0]?.lessons).toMatchObject([
      { id: lesson.id, position: 0, title: "First lesson" },
    ]);

    // Tagged by its course, never chapter by chapter: a course can hold more chapters than a cache
    // entry has tags for, and a chapter's change refreshes it through the course's tag.
    const tags = vi.mocked(cacheTag).mock.calls.flat();
    expect(tags).toContain(getCourseCurriculumCacheTag(course.id));
    expect(tags).not.toContain(getLibraryChapterCacheTag(beginnerFirst.id));
  });

  it("shows private chapters and lessons only to their owner", async () => {
    const owner = await userFixture();

    const [course, sharedChapter, privateChapter, privateLesson] = await Promise.all([
      courseFixture({ userId: owner.id, visibility: "private" }),
      libraryChapterFixture(),
      libraryChapterFixture({ ownerId: owner.id, visibility: "private" }),
      libraryLessonFixture({ ownerId: owner.id, visibility: "private" }),
    ]);

    await Promise.all([
      courseChapterFixture({ chapterId: sharedChapter.id, courseId: course.id, position: 0 }),
      courseChapterFixture({ chapterId: privateChapter.id, courseId: course.id, position: 1 }),
      chapterLessonFixture({ chapterId: privateChapter.id, lessonId: privateLesson.id }),
    ]);

    await expect(getLibraryCourse({ courseId: course.id })).resolves.toBeNull();

    mockSession(owner.id);

    const result = await getLibraryCourse({ courseId: course.id });

    expect(result?.levels[0]?.chapters.map((chapter) => chapter.id)).toStrictEqual([
      sharedChapter.id,
      privateChapter.id,
    ]);

    expect(result?.levels[0]?.chapters[1]?.lessons.map((item) => item.id)).toStrictEqual([
      privateLesson.id,
    ]);
  });

  it("hides a private chapter placed in a shared course from other learners", async () => {
    const [owner, viewer] = await Promise.all([userFixture(), userFixture()]);

    const [course, privateChapter] = await Promise.all([
      courseFixture(),
      libraryChapterFixture({ ownerId: owner.id, visibility: "private" }),
    ]);

    await courseChapterFixture({ chapterId: privateChapter.id, courseId: course.id });
    mockSession(viewer.id);

    await expect(getLibraryCourse({ courseId: course.id })).resolves.toMatchObject({ levels: [] });
  });

  it("returns null for unknown or malformed ids", async () => {
    await expect(getLibraryCourse({ courseId: randomUUID() })).resolves.toBeNull();
    await expect(getLibraryCourse({ courseId: "course" })).resolves.toBeNull();
  });
});
