import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { cacheTag } from "next/cache";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getCourseCurriculumCacheTag } from "../cache/tags";
import { getNextLessonAfter, getNextLessonInCourse } from "./get-next-lesson-in-course";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/**
 * Creates a two-lesson published curriculum whose course ownership can vary
 * independently from the structural successor lookup.
 */
async function createSuccessorCurriculum({
  organizationId,
  userId,
}: {
  organizationId: string | null;
  userId?: string;
}) {
  const course = await courseFixture({ isPublished: true, organizationId, userId });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId,
    position: 0,
  });

  const [lesson, nextLesson] = await Promise.all([
    lessonFixture({ chapterId: chapter.id, isPublished: true, organizationId, position: 0 }),
    lessonFixture({ chapterId: chapter.id, isPublished: true, organizationId, position: 1 }),
  ]);

  return { lesson, nextLesson };
}

describe(getNextLessonInCourse, () => {
  let courseId: string;
  let orgId: string;

  let chapter1Id: string;
  let chapter1Slug: string;
  let chapter2Id: string;
  let chapter2Slug: string;

  let lesson1Id: string;
  let lesson2Id: string;
  let lesson2Slug: string;
  let lesson3Id: string;
  let lesson3Slug: string;

  beforeAll(async () => {
    const org = await organizationFixture({ kind: "brand" });
    orgId = org.id;

    const course = await courseFixture({ isPublished: true, organizationId: orgId });
    courseId = course.id;

    const [ch1, ch2] = await Promise.all([
      chapterFixture({ courseId, isPublished: true, organizationId: orgId, position: 0 }),
      chapterFixture({ courseId, isPublished: true, organizationId: orgId, position: 1 }),
    ]);

    chapter1Id = ch1.id;
    chapter1Slug = ch1.slug;
    chapter2Id = ch2.id;
    chapter2Slug = ch2.slug;

    // Chapter 1: 2 lessons
    const initialLessons = await Promise.all([
      lessonFixture({
        chapterId: chapter1Id,
        isPublished: true,
        organizationId: orgId,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter1Id,
        isPublished: true,
        organizationId: orgId,
        position: 1,
      }),
    ]);

    const lesson1 = initialLessons[0];
    const lesson2 = initialLessons[1];
    lesson1Id = lesson1.id;
    lesson2Id = lesson2.id;
    lesson2Slug = lesson2.slug;

    // Chapter 2: 1 lesson
    const lesson3 = await lessonFixture({
      chapterId: chapter2Id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });

    lesson3Id = lesson3.id;
    lesson3Slug = lesson3.slug;
  });

  it("returns next lesson in same chapter", async () => {
    const result = await getNextLessonInCourse({ courseId, lessonId: lesson1Id });

    expect(result).toMatchObject({
      chapterId: chapter1Id,
      chapterSlug: chapter1Slug,
      lessonId: lesson2Id,
      lessonSlug: lesson2Slug,
    });

    expect(cacheTag).toHaveBeenCalledWith(getCourseCurriculumCacheTag(courseId));
  });

  it("locates the current lesson by ID after an earlier split shifts positions", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
    });

    const [earlierLesson, currentLesson, nextLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 2,
      }),
    ]);

    await prisma.lesson.updateMany({
      data: { position: { increment: 2 } },
      where: { chapterId: chapter.id, position: { gt: earlierLesson.position } },
    });

    await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 2,
      }),
    ]);

    await expect(
      getNextLessonInCourse({ courseId: course.id, lessonId: currentLesson.id }),
    ).resolves.toMatchObject({ lessonId: nextLesson.id });
  });

  it("uses an unpublished current lesson as the anchor for published successors", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
    });

    const [currentLesson, nextLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: false,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    await expect(
      getNextLessonInCourse({ courseId: course.id, lessonId: currentLesson.id }),
    ).resolves.toMatchObject({ lessonId: nextLesson.id });
  });

  it("returns first lesson of next chapter when at last lesson of current chapter", async () => {
    const result = await getNextLessonInCourse({ courseId, lessonId: lesson2Id });

    expect(result).toMatchObject({
      chapterId: chapter2Id,
      chapterSlug: chapter2Slug,
      lessonId: lesson3Id,
      lessonSlug: lesson3Slug,
    });
  });

  it("returns null when at the last lesson of the course", async () => {
    const result = await getNextLessonInCourse({ courseId, lessonId: lesson3Id });

    expect(result).toBeNull();
  });

  it("returns null for a non-existent course", async () => {
    const result = await getNextLessonInCourse({
      courseId: "missing-course-id",
      lessonId: lesson1Id,
    });

    expect(result).toBeNull();
  });

  it("includes lesson kind and title in result", async () => {
    const result = await getNextLessonInCourse({ courseId, lessonId: lesson1Id });

    expect(result).toHaveProperty("lessonKind");
    expect(result).toHaveProperty("lessonTitle");
    expect(result).toHaveProperty("lessonDescription");
    expect(result).toHaveProperty("lessonGenerationStatus");
  });

  it("skips unpublished lessons", async () => {
    const testOrg = await organizationFixture({ kind: "brand" });
    const testCourse = await courseFixture({ isPublished: true, organizationId: testOrg.id });

    const testChapter = await chapterFixture({
      courseId: testCourse.id,
      isPublished: true,
      organizationId: testOrg.id,
      position: 0,
    });

    const lessons = await Promise.all([
      lessonFixture({
        chapterId: testChapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: testChapter.id,
        generationStatus: "completed",
        isPublished: false,
        organizationId: testOrg.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: testChapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: testOrg.id,
        position: 2,
      }),
    ]);

    const thirdLesson = lessons[2];

    const result = await getNextLessonInCourse({
      courseId: testCourse.id,
      lessonId: lessons[0]!.id,
    });

    expect(result).toMatchObject({
      chapterSlug: testChapter.slug,
      lessonId: thirdLesson?.id,
      lessonPosition: 2,
      lessonSlug: thirdLesson?.slug,
    });
  });

  it("skips excluded lesson kinds", async () => {
    const testOrg = await organizationFixture({ kind: "brand" });
    const testCourse = await courseFixture({ isPublished: true, organizationId: testOrg.id });

    const testChapter = await chapterFixture({
      courseId: testCourse.id,
      isPublished: true,
      organizationId: testOrg.id,
      position: 0,
    });

    const lessons = await Promise.all([
      lessonFixture({
        chapterId: testChapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "explanation",
        organizationId: testOrg.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: testChapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "quiz",
        organizationId: testOrg.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: testChapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "practice",
        organizationId: testOrg.id,
        position: 2,
      }),
    ]);

    const practiceLesson = lessons[2];

    const result = await getNextLessonInCourse({
      courseId: testCourse.id,
      excludedLessonKinds: ["quiz"],
      lessonId: lessons[0]!.id,
    });

    expect(result).toMatchObject({
      chapterSlug: testChapter.slug,
      lessonId: practiceLesson.id,
      lessonKind: "practice",
      lessonPosition: 2,
      lessonSlug: practiceLesson.slug,
    });
  });

  it("returns the next lesson shell even when it still needs generation", async () => {
    const testOrg = await organizationFixture({ kind: "brand" });
    const testCourse = await courseFixture({ isPublished: true, organizationId: testOrg.id });

    const testChapter = await chapterFixture({
      courseId: testCourse.id,
      isPublished: true,
      organizationId: testOrg.id,
      position: 0,
    });

    const pendingLessons = await Promise.all([
      lessonFixture({
        chapterId: testChapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: testChapter.id,
        generationStatus: "pending",
        isPublished: true,
        organizationId: testOrg.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: testChapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: testOrg.id,
        position: 2,
      }),
    ]);

    const pendingLesson = pendingLessons[1];

    const result = await getNextLessonInCourse({
      courseId: testCourse.id,
      lessonId: pendingLessons[0]!.id,
    });

    expect(result).toMatchObject({
      chapterSlug: testChapter.slug,
      lessonId: pendingLesson?.id,
      lessonPosition: 1,
      lessonSlug: pendingLesson?.slug,
    });
  });

  it("skips unpublished lessons when moving through a chapter", async () => {
    const testOrg = await organizationFixture({ kind: "brand" });
    const testCourse = await courseFixture({ isPublished: true, organizationId: testOrg.id });

    const testChapter = await chapterFixture({
      courseId: testCourse.id,
      isPublished: true,
      organizationId: testOrg.id,
      position: 0,
    });

    const lessons = await Promise.all([
      lessonFixture({
        chapterId: testChapter.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: testChapter.id,
        isPublished: false,
        organizationId: testOrg.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: testChapter.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 2,
      }),
    ]);

    const nextPublishedLesson = lessons[2];

    const result = await getNextLessonInCourse({
      courseId: testCourse.id,
      lessonId: lessons[0]!.id,
    });

    expect(result).toMatchObject({
      chapterSlug: testChapter.slug,
      lessonId: nextPublishedLesson.id,
      lessonPosition: 2,
      lessonSlug: nextPublishedLesson.slug,
    });
  });

  it("skips lessons in unpublished chapters", async () => {
    const testOrg = await organizationFixture({ kind: "brand" });
    const testCourse = await courseFixture({ isPublished: true, organizationId: testOrg.id });

    const [publishedCh, unpublishedCh, nextPublishedCh] = await Promise.all([
      chapterFixture({
        courseId: testCourse.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
      chapterFixture({
        courseId: testCourse.id,
        isPublished: false,
        organizationId: testOrg.id,
        position: 1,
      }),
      chapterFixture({
        courseId: testCourse.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 2,
      }),
    ]);

    const lessons = await Promise.all([
      lessonFixture({
        chapterId: publishedCh.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: unpublishedCh.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: nextPublishedCh.id,
        isPublished: true,
        organizationId: testOrg.id,
        position: 0,
      }),
    ]);

    const lesson3 = lessons[2];

    const result = await getNextLessonInCourse({
      courseId: testCourse.id,
      lessonId: lessons[0]!.id,
    });

    expect(result).toMatchObject({
      chapterSlug: nextPublishedCh.slug,
      lessonId: lesson3.id,
      lessonPosition: 0,
      lessonSlug: lesson3.slug,
    });
  });
});

describe(getNextLessonAfter, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("returns a public brand curriculum successor to a guest", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    const { lesson, nextLesson } = await createSuccessorCurriculum({
      organizationId: organization.id,
    });

    await expect(getNextLessonAfter({ lessonId: lesson.id })).resolves.toMatchObject({
      lesson: { lessonId: nextLesson.id },
      status: "ready",
    });
  });

  it("does not expose a non-brand organization curriculum by lesson ID", async () => {
    const organization = await organizationFixture({ kind: "school" });
    const { lesson } = await createSuccessorCurriculum({ organizationId: organization.id });

    await expect(getNextLessonAfter({ lessonId: lesson.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("only returns a personal curriculum successor to its owner", async () => {
    const [owner, otherUser] = await Promise.all([userFixture(), userFixture()]);

    const { lesson, nextLesson } = await createSuccessorCurriculum({
      organizationId: null,
      userId: owner.id,
    });

    mockSession(otherUser.id);

    await expect(getNextLessonAfter({ lessonId: lesson.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(owner.id);

    await expect(getNextLessonAfter({ lessonId: lesson.id })).resolves.toMatchObject({
      lesson: { lessonId: nextLesson.id },
      status: "ready",
    });
  });
});
