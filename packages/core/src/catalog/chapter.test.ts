import { randomUUID } from "node:crypto";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getCatalogChapter } from "./chapter";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

describe(getCatalogChapter, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("reads a chapter in its home course by default and in another course that places it", async () => {
    const [home, other] = await Promise.all([
      catalogCourseFixture({ lessonCounts: [1, 1] }),
      catalogCourseFixture({ lessonCounts: [1] }),
    ]);

    const shared = home.chapters[1]!;

    await courseChapterFixture({
      chapterId: shared.id,
      courseId: other.course.id,
      level: "advanced",
      position: 0,
    });

    const [inHome, inOther] = await Promise.all([
      getCatalogChapter({ chapterId: shared.id }),
      getCatalogChapter({ chapterId: shared.id, courseId: other.course.id }),
    ]);

    expect(inHome).toMatchObject({
      chapter: { id: shared.id, title: shared.title },
      courseId: home.course.id,
      level: "beginner",
      position: 1,
    });

    expect(inOther).toMatchObject({
      chapter: { id: shared.id },
      courseId: other.course.id,
      level: "advanced",
      position: 1,
    });
  });

  it("isn't found in a course that doesn't place it", async () => {
    const [home, other] = await Promise.all([
      catalogCourseFixture({ lessonCounts: [1] }),
      catalogCourseFixture({ lessonCounts: [1] }),
    ]);

    await expect(
      getCatalogChapter({ chapterId: home.chapters[0]!.id, courseId: other.course.id }),
    ).resolves.toBeNull();
  });

  it("isn't found when its home course isn't in the catalog and no course is given", async () => {
    const [unpublished, catalog] = await Promise.all([
      courseFixture({ isPublished: false }),
      catalogCourseFixture({ lessonCounts: [] }),
    ]);

    const chapter = await libraryChapterFixture({ homeCourseId: unpublished.id });

    await Promise.all([
      courseChapterFixture({ chapterId: chapter.id, courseId: unpublished.id }),
      courseChapterFixture({ chapterId: chapter.id, courseId: catalog.course.id }),
    ]);

    await expect(getCatalogChapter({ chapterId: chapter.id })).resolves.toBeNull();

    await expect(
      getCatalogChapter({ chapterId: chapter.id, courseId: catalog.course.id }),
    ).resolves.toMatchObject({ courseId: catalog.course.id, position: 0 });
  });

  it("shows a private chapter only to its owner", async () => {
    const [owner, viewer, { course }] = await Promise.all([
      userFixture(),
      userFixture(),
      catalogCourseFixture({ lessonCounts: [] }),
    ]);

    const chapter = await libraryChapterFixture({
      homeCourseId: course.id,
      ownerId: owner.id,
      visibility: "private",
    });

    await courseChapterFixture({ chapterId: chapter.id, courseId: course.id });

    mockSession(viewer.id);
    await expect(getCatalogChapter({ chapterId: chapter.id })).resolves.toBeNull();

    mockSession(owner.id);

    await expect(getCatalogChapter({ chapterId: chapter.id })).resolves.toMatchObject({
      chapter: { id: chapter.id },
      courseId: course.id,
    });
  });

  it("returns null for unknown or malformed ids", async () => {
    const { chapters } = await catalogCourseFixture({ lessonCounts: [1] });

    const results = await Promise.all([
      getCatalogChapter({ chapterId: randomUUID() }),
      getCatalogChapter({ chapterId: "not-a-uuid" }),
      getCatalogChapter({ chapterId: chapters[0]!.id, courseId: "not-a-uuid" }),
    ]);

    expect(results).toStrictEqual([null, null, null]);
  });
});
