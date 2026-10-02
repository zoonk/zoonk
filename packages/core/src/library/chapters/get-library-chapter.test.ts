import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { cacheTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { getLibraryChapter } from "./get-library-chapter";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

describe(getLibraryChapter, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("returns the chapter's lessons in order with their home course", async () => {
    const course = await courseFixture();

    const [chapter, first, second] = await Promise.all([
      libraryChapterFixture({ homeCourseId: course.id }),
      libraryLessonFixture({ title: "First" }),
      libraryLessonFixture({ contentStatus: "completed", title: "Second" }),
    ]);

    await Promise.all([
      chapterLessonFixture({ chapterId: chapter.id, lessonId: second.id, position: 1 }),
      chapterLessonFixture({ chapterId: chapter.id, lessonId: first.id, position: 0 }),
    ]);

    const result = await getLibraryChapter({ chapterId: chapter.id });

    expect(result).toMatchObject({
      homeCourse: { id: course.id, slug: course.slug },
      id: chapter.id,
      lessons: [
        { id: first.id, position: 0, title: "First" },
        { contentStatus: "completed", id: second.id, position: 1, title: "Second" },
      ],
    });

    expect(vi.mocked(cacheTag).mock.calls.flat()).toStrictEqual(
      expect.arrayContaining([
        getLibraryLessonCacheTag(first.id),
        getLibraryLessonCacheTag(second.id),
      ]),
    );
  });

  it("shows a private chapter and its private lessons only to the owner", async () => {
    const [owner, viewer] = await Promise.all([userFixture(), userFixture()]);

    const [chapter, sharedLesson, privateLesson] = await Promise.all([
      libraryChapterFixture({ ownerId: owner.id, visibility: "private" }),
      libraryLessonFixture(),
      libraryLessonFixture({ ownerId: owner.id, visibility: "private" }),
    ]);

    await Promise.all([
      chapterLessonFixture({ chapterId: chapter.id, lessonId: sharedLesson.id, position: 0 }),
      chapterLessonFixture({ chapterId: chapter.id, lessonId: privateLesson.id, position: 1 }),
    ]);

    await expect(getLibraryChapter({ chapterId: chapter.id })).resolves.toBeNull();

    mockSession(viewer.id);
    await expect(getLibraryChapter({ chapterId: chapter.id })).resolves.toBeNull();

    mockSession(owner.id);

    const result = await getLibraryChapter({ chapterId: chapter.id });

    expect(result?.lessons.map((lesson) => lesson.id)).toStrictEqual([
      sharedLesson.id,
      privateLesson.id,
    ]);
  });
});
