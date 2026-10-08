import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { getCourseCurriculumCacheTag, getLibraryChapterCacheTag } from "../../cache/tags";
import { placeChapterLessons } from "./place-chapter-lessons";

describe(placeChapterLessons, () => {
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
