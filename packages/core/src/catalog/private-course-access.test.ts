import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { courseChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  catalogCourseFixture,
  privateCourseFixture,
} from "@zoonk/testing/fixtures/library-courses";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getCatalogChapter } from "./chapter";
import { listCatalogChapterLessons } from "./chapter-lessons";
import { listCatalogCourseChapters } from "./course-chapters";
import { getCatalogChapterNextLesson, getCatalogCourseNextLesson } from "./next-lesson";
import { getCatalogChapterProgress, getCatalogCourseProgress } from "./progress";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/** Every catalog read of a course and one of its chapters, as the current session sees them. */
async function readCourse({ chapterId, courseId }: { chapterId: string; courseId: string }) {
  const [chapters, chapter, lessons, courseNext, chapterNext, courseProgress, chapterProgress] =
    await Promise.all([
      listCatalogCourseChapters({ courseId }),
      getCatalogChapter({ chapterId, courseId }),
      listCatalogChapterLessons({ chapterId, courseId }),
      getCatalogCourseNextLesson({ courseId }),
      getCatalogChapterNextLesson({ chapterId, courseId }),
      getCatalogCourseProgress({ courseId }),
      getCatalogChapterProgress({ chapterId }),
    ]);

  return { chapter, chapterNext, chapterProgress, chapters, courseNext, courseProgress, lessons };
}

const HIDDEN = {
  chapter: null,
  chapterNext: { status: "notFound" },
  chapterProgress: null,
  chapters: null,
  courseNext: { status: "notFound" },
  courseProgress: null,
  lessons: null,
};

describe("private courses in the catalog", () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("serves the owner their course, its chapters and lessons, the next lesson and progress", async () => {
    const owner = await userFixture();

    const { chapters, course, lessons } = await privateCourseFixture({
      lessonCounts: [2],
      ownerId: owner.id,
    });

    const [chapter] = chapters;
    const [first, second] = lessons[0]!;

    await learningEventFixture({ contentIds: { lessonId: first!.id }, userId: owner.id });

    mockSession(owner.id);

    const nextLesson = {
      brandSlug: null,
      chapterId: chapter!.id,
      courseId: course.id,
      courseSlug: course.slug,
      hasStarted: true,
      lessonId: second!.id,
      lessonPosition: 1,
      type: "lesson",
    };

    await expect(
      readCourse({ chapterId: chapter!.id, courseId: course.id }),
    ).resolves.toMatchObject({
      chapter: {
        chapter: { id: chapter!.id },
        courseId: course.id,
        level: "beginner",
        position: 0,
      },
      chapterNext: { status: "ready", target: nextLesson },
      chapterProgress: { percentComplete: 50 },
      chapters: [{ chapter: { id: chapter!.id }, courseId: course.id, position: 0 }],
      courseNext: { status: "ready", target: nextLesson },
      courseProgress: {
        chapters: [{ chapterId: chapter!.id, completedLessons: 1, totalLessons: 2 }],
        percentComplete: 50,
      },
      lessons: {
        chapterId: chapter!.id,
        courseId: course.id,
        lessons: [{ id: first!.id }, { id: second!.id }],
      },
    });

    await expect(getCatalogChapter({ chapterId: chapter!.id })).resolves.toMatchObject({
      courseId: course.id,
    });
  });

  it("hides the course from other learners and visitors", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const { chapters, course } = await privateCourseFixture({ ownerId: owner.id });
    const input = { chapterId: chapters[0]!.id, courseId: course.id };

    await expect(readCourse(input)).resolves.toStrictEqual(HIDDEN);

    mockSession(other.id);
    await expect(readCourse(input)).resolves.toStrictEqual(HIDDEN);
  });

  it("reads a shared chapter in the owner's private course only for the owner", async () => {
    const [owner, other, brand] = await Promise.all([
      userFixture(),
      userFixture(),
      catalogCourseFixture({ lessonCounts: [1] }),
    ]);

    const { course } = await privateCourseFixture({ lessonCounts: [], ownerId: owner.id });
    const shared = brand.chapters[0]!;

    await courseChapterFixture({ chapterId: shared.id, courseId: course.id });

    const readInPrivateCourse = () =>
      Promise.all([
        getCatalogChapter({ chapterId: shared.id, courseId: course.id }),
        listCatalogChapterLessons({ chapterId: shared.id, courseId: course.id }),
      ]);

    mockSession(other.id);

    await expect(readInPrivateCourse()).resolves.toStrictEqual([null, null]);

    await expect(getCatalogChapter({ chapterId: shared.id })).resolves.toMatchObject({
      courseId: brand.course.id,
    });

    mockSession(owner.id);

    await expect(readInPrivateCourse()).resolves.toMatchObject([
      { chapter: { id: shared.id }, courseId: course.id },
      { courseId: course.id, lessons: [{ id: brand.lessons[0]![0]!.id }] },
    ]);
  });
});
