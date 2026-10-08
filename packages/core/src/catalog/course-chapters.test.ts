import { randomUUID } from "node:crypto";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { listCatalogCourseChapters } from "./course-chapters";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

describe(listCatalogCourseChapters, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("lists chapters in reading order across level bands with their placement", async () => {
    const { course } = await catalogCourseFixture({ lessonCounts: [] });

    const [overview, beginner, advanced, lesson] = await Promise.all([
      libraryChapterFixture({ level: "overview", title: "Overview" }),
      libraryChapterFixture({ title: "Beginner" }),
      libraryChapterFixture({ level: "advanced", title: "Advanced" }),
      libraryLessonFixture(),
    ]);

    await Promise.all([
      courseChapterFixture({
        chapterId: advanced.id,
        courseId: course.id,
        level: "advanced",
        position: 0,
      }),
      courseChapterFixture({ chapterId: beginner.id, courseId: course.id, position: 0 }),
      courseChapterFixture({
        chapterId: overview.id,
        courseId: course.id,
        level: "overview",
        position: 0,
      }),
      chapterLessonFixture({ chapterId: beginner.id, lessonId: lesson.id, position: 0 }),
    ]);

    const chapters = await listCatalogCourseChapters({ courseId: course.id });

    expect(
      chapters?.map((item) => ({
        courseId: item.courseId,
        id: item.chapter.id,
        lessons: item.chapter.lessons.length,
        level: item.level,
        position: item.position,
      })),
    ).toStrictEqual([
      { courseId: course.id, id: overview.id, lessons: 0, level: "overview", position: 0 },
      { courseId: course.id, id: beginner.id, lessons: 1, level: "beginner", position: 1 },
      { courseId: course.id, id: advanced.id, lessons: 0, level: "advanced", position: 2 },
    ]);
  });

  it("hides private chapters and lessons from other learners", async () => {
    const [owner, viewer] = await Promise.all([userFixture(), userFixture()]);
    const { chapters, course } = await catalogCourseFixture({ lessonCounts: [1] });

    const [privateChapter, privateLesson] = await Promise.all([
      libraryChapterFixture({ ownerId: owner.id, visibility: "private" }),
      libraryLessonFixture({ ownerId: owner.id, visibility: "private" }),
    ]);

    await Promise.all([
      courseChapterFixture({ chapterId: privateChapter.id, courseId: course.id, position: 1 }),
      chapterLessonFixture({ chapterId: chapters[0]!.id, lessonId: privateLesson.id, position: 1 }),
    ]);

    mockSession(viewer.id);

    const result = await listCatalogCourseChapters({ courseId: course.id });

    expect(result?.map((item) => item.chapter.id)).toStrictEqual([chapters[0]!.id]);
    expect(result?.[0]?.chapter.lessons).toHaveLength(1);
  });

  it("returns null outside the published brand catalog and for others' private courses", async () => {
    const [viewer, owner, brand, school] = await Promise.all([
      userFixture(),
      userFixture(),
      organizationFixture({ kind: "brand" }),
      organizationFixture({ kind: "school" }),
    ]);

    const courses = await Promise.all([
      courseFixture({ isPublished: false, organizationId: brand.id }),
      courseFixture({ isPublished: true, organizationId: school.id }),
      courseFixture({ userId: owner.id, visibility: "private" }),
    ]);

    mockSession(viewer.id);

    const results = await Promise.all([
      ...courses.map((course) => listCatalogCourseChapters({ courseId: course.id })),
      listCatalogCourseChapters({ courseId: randomUUID() }),
      listCatalogCourseChapters({ courseId: "not-a-uuid" }),
    ]);

    expect(results).toStrictEqual([null, null, null, null, null]);
  });
});
