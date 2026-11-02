import { prisma } from "@zoonk/db";
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
import { revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { getCourseCurriculumCacheTag, getLibraryChapterCacheTag } from "../../cache/tags";
import { placeChapterLessons } from "./place-chapter-lessons";

describe(placeChapterLessons, () => {
  it("keeps private lessons out of public chapters without replacing the existing outline", async () => {
    const owner = await userFixture();

    const [chapter, shared, privateLesson] = await Promise.all([
      libraryChapterFixture(),
      libraryLessonFixture(),
      libraryLessonFixture({ ownerId: owner.id, visibility: "private" }),
    ]);

    await chapterLessonFixture({ chapterId: chapter.id, lessonId: shared.id });

    await expect(
      placeChapterLessons({ chapterId: chapter.id, lessonIds: [shared.id, privateLesson.id] }),
    ).rejects.toThrow("Private content");

    await expect(
      prisma.chapterLesson.findMany({ where: { chapterId: chapter.id } }),
    ).resolves.toMatchObject([{ lessonId: shared.id, position: 0 }]);
  });

  it("refreshes the chapter and the outline of every course that places it", async () => {
    const [chapter, first, second, lesson] = await Promise.all([
      libraryChapterFixture(),
      courseFixture(),
      courseFixture(),
      libraryLessonFixture(),
    ]);

    await Promise.all([
      courseChapterFixture({ chapterId: chapter.id, courseId: first.id }),
      courseChapterFixture({ chapterId: chapter.id, courseId: second.id }),
    ]);

    vi.mocked(revalidateTag).mockClear();
    await placeChapterLessons({ chapterId: chapter.id, lessonIds: [lesson.id] });

    expect(vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag)).toStrictEqual(
      expect.arrayContaining([
        getLibraryChapterCacheTag(chapter.id),
        getCourseCurriculumCacheTag(first.id),
        getCourseCurriculumCacheTag(second.id),
      ]),
    );
  });
});
