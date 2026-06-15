import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  getCatalogChapterProgress,
  getCatalogLessonProgress,
  getChapterContinueProgress,
  getCourseContinueProgress,
} from "./catalog-progress";

const catalogContext = await createAuthenticatedCatalogContext();

/**
 * Catalog progress functions accept request headers for tests, matching the
 * lower-level progress helpers they wrap while keeping server components on
 * the default `next/headers` path.
 */
async function createAuthenticatedCatalogContext() {
  const [organization, user] = await Promise.all([organizationFixture(), userFixture()]);
  const headers = await signInAs(user.email, user.password);

  return { headers, organization, user };
}

/**
 * React cache can hold the no-argument session lookup for the current test
 * worker, so all catalog progress tests share one authenticated learner while
 * still creating their own course data.
 */
function getAuthenticatedCatalogContext() {
  return catalogContext;
}

/**
 * Course-level tests need a published course plus three published chapters so
 * they can prove exact totals and pending-chapter estimates without relying on
 * seed data.
 */
async function createPublishedCourseChapters({
  chapter3GenerationStatus = "completed",
  organizationId,
}: {
  chapter3GenerationStatus?: "completed" | "pending";
  organizationId: string;
}) {
  const course = await courseFixture({ isPublished: true, organizationId });

  const [chapter1, chapter2, chapter3] = await Promise.all([
    chapterFixture({
      courseId: course.id,
      generationStatus: "completed",
      isPublished: true,
      organizationId,
      position: 0,
    }),
    chapterFixture({
      courseId: course.id,
      generationStatus: "completed",
      isPublished: true,
      organizationId,
      position: 1,
    }),
    chapterFixture({
      courseId: course.id,
      generationStatus: chapter3GenerationStatus,
      isPublished: true,
      organizationId,
      position: 2,
    }),
  ]);

  return { chapter1, chapter2, chapter3, course };
}

/**
 * Lesson fixtures are created in chapter order so progress rows can assert the
 * same ordering learners see in catalog lists.
 */
async function createPublishedLessons({
  chapterId,
  count,
  organizationId,
}: {
  chapterId: string;
  count: number;
  organizationId: string;
}) {
  return Promise.all(
    Array.from({ length: count }, (_, position) =>
      lessonFixture({ chapterId, isPublished: true, organizationId, position }),
    ),
  );
}

/**
 * Completion rows are the learner-facing source of truth for catalog progress,
 * so tests write the same records the player completion path would persist.
 */
async function completeLessons({ lessonIds, userId }: { lessonIds: string[]; userId: string }) {
  await Promise.all(
    lessonIds.map((lessonId) =>
      lessonProgressFixture({ completedAt: new Date(), durationSeconds: 60, lessonId, userId }),
    ),
  );
}

describe("catalog progress data", () => {
  it("returns lesson progress rows for the chapter grid", async () => {
    const { headers, organization, user } = getAuthenticatedCatalogContext();
    const { chapter1 } = await createPublishedCourseChapters({ organizationId: organization.id });

    const [completedLesson, pendingLesson] = await createPublishedLessons({
      chapterId: chapter1.id,
      count: 2,
      organizationId: organization.id,
    });

    if (!completedLesson || !pendingLesson) {
      throw new Error("Expected the chapter lesson fixtures to be created");
    }

    await completeLessons({ lessonIds: [completedLesson.id], userId: user.id });

    await expect(
      getCatalogLessonProgress({ chapterId: chapter1.id, headers }),
    ).resolves.toStrictEqual([
      { isCompleted: true, lessonId: completedLesson.id },
      { isCompleted: false, lessonId: pendingLesson.id },
    ]);
  });

  it("returns chapter progress rows for the course grid", async () => {
    const { headers, organization, user } = getAuthenticatedCatalogContext();

    const { chapter1, chapter2, chapter3, course } = await createPublishedCourseChapters({
      organizationId: organization.id,
    });

    const [chapter1Lessons, chapter2Lessons] = await Promise.all([
      createPublishedLessons({ chapterId: chapter1.id, count: 2, organizationId: organization.id }),
      createPublishedLessons({ chapterId: chapter2.id, count: 1, organizationId: organization.id }),
    ]);

    const [chapter1Lesson] = chapter1Lessons;
    const [chapter2Lesson] = chapter2Lessons;

    if (!chapter1Lesson || !chapter2Lesson) {
      throw new Error("Expected each chapter to have a lesson fixture");
    }

    await completeLessons({ lessonIds: [chapter1Lesson.id, chapter2Lesson.id], userId: user.id });

    await expect(
      getCatalogChapterProgress({ courseId: course.id, headers }),
    ).resolves.toStrictEqual([
      { chapterId: chapter1.id, completedLessons: 1, totalLessons: 2 },
      { chapterId: chapter2.id, completedLessons: 1, totalLessons: 1 },
      { chapterId: chapter3.id, completedLessons: 0, totalLessons: 0 },
    ]);
  });

  it("returns exact chapter continue percentages", async () => {
    const { headers, organization, user } = getAuthenticatedCatalogContext();
    const { chapter1 } = await createPublishedCourseChapters({ organizationId: organization.id });

    const [completedLesson] = await createPublishedLessons({
      chapterId: chapter1.id,
      count: 3,
      organizationId: organization.id,
    });

    if (!completedLesson) {
      throw new Error("Expected a completed lesson fixture");
    }

    await completeLessons({ lessonIds: [completedLesson.id], userId: user.id });

    await expect(
      getChapterContinueProgress({ chapterId: chapter1.id, headers }),
    ).resolves.toStrictEqual({ percentComplete: 33 });
  });

  it("returns exact course continue percentages when every chapter is generated", async () => {
    const { headers, organization, user } = getAuthenticatedCatalogContext();

    const { chapter1, chapter2, chapter3, course } = await createPublishedCourseChapters({
      organizationId: organization.id,
    });

    const [chapter1Lessons, chapter2Lessons] = await Promise.all([
      createPublishedLessons({ chapterId: chapter1.id, count: 3, organizationId: organization.id }),
      createPublishedLessons({ chapterId: chapter2.id, count: 2, organizationId: organization.id }),
      createPublishedLessons({ chapterId: chapter3.id, count: 2, organizationId: organization.id }),
    ]);

    const [chapter1Lesson1, chapter1Lesson2, chapter1Lesson3] = chapter1Lessons;
    const [chapter2Lesson1] = chapter2Lessons;

    if (!chapter1Lesson1 || !chapter1Lesson2 || !chapter1Lesson3 || !chapter2Lesson1) {
      throw new Error("Expected completed lesson fixtures for exact course progress");
    }

    await completeLessons({
      lessonIds: [chapter1Lesson1.id, chapter1Lesson2.id, chapter1Lesson3.id, chapter2Lesson1.id],
      userId: user.id,
    });

    await expect(
      getCourseContinueProgress({ courseId: course.id, headers }),
    ).resolves.toStrictEqual({ percentComplete: 57 });
  });

  it("estimates course continue percentages while later chapters are pending", async () => {
    const { headers, organization, user } = getAuthenticatedCatalogContext();

    const { chapter1, chapter2, course } = await createPublishedCourseChapters({
      chapter3GenerationStatus: "pending",
      organizationId: organization.id,
    });

    const [chapter1Lessons, chapter2Lessons] = await Promise.all([
      createPublishedLessons({ chapterId: chapter1.id, count: 3, organizationId: organization.id }),
      createPublishedLessons({ chapterId: chapter2.id, count: 2, organizationId: organization.id }),
    ]);

    const [chapter1Lesson] = chapter1Lessons;
    const [chapter2Lesson] = chapter2Lessons;

    if (!chapter1Lesson || !chapter2Lesson) {
      throw new Error("Expected completed lesson fixtures for estimated course progress");
    }

    await completeLessons({ lessonIds: [chapter1Lesson.id, chapter2Lesson.id], userId: user.id });

    await expect(
      getCourseContinueProgress({ courseId: course.id, headers }),
    ).resolves.toStrictEqual({ percentComplete: 25 });
  });

  it("applies hidden lesson-kind filters across catalog and continue progress", async () => {
    const { headers, organization, user } = getAuthenticatedCatalogContext();

    const { chapter1, course } = await createPublishedCourseChapters({
      organizationId: organization.id,
    });

    const [visibleLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter1.id,
        isPublished: true,
        kind: "explanation",
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter1.id,
        isPublished: true,
        kind: "quiz",
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    await completeLessons({ lessonIds: [visibleLesson.id], userId: user.id });

    await expect(
      getCatalogLessonProgress({ chapterId: chapter1.id, excludedLessonKinds: ["quiz"], headers }),
    ).resolves.toStrictEqual([{ isCompleted: true, lessonId: visibleLesson.id }]);

    await expect(
      getCatalogChapterProgress({ courseId: course.id, excludedLessonKinds: ["quiz"], headers }),
    ).resolves.toContainEqual({ chapterId: chapter1.id, completedLessons: 1, totalLessons: 1 });

    await expect(
      getChapterContinueProgress({
        chapterId: chapter1.id,
        excludedLessonKinds: ["quiz"],
        headers,
      }),
    ).resolves.toStrictEqual({ percentComplete: 100 });

    await expect(
      getCourseContinueProgress({ courseId: course.id, excludedLessonKinds: ["quiz"], headers }),
    ).resolves.toStrictEqual({ percentComplete: 100 });
  });
});
