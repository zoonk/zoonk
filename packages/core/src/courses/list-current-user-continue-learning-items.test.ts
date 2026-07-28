import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { MAX_CONTINUE_LEARNING_ITEMS } from "./continue-learning-contract";
import { listCurrentUserContinueLearningItems } from "./list-current-user-continue-learning-items";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/** Calls the continuation capability as one fixture learner or guest. */
function listForUser(userId: string | null) {
  mockSession(userId);
  return listCurrentUserContinueLearningItems();
}

/**
 * Builds the common two-lesson published course used by feed behavior tests.
 */
async function createCourseWithLessons(organizationId: string) {
  const course = await courseFixture({ isPublished: true, organizationId });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId,
    position: 0,
  });

  const [lesson1, lesson2] = await Promise.all([
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      organizationId,
      position: 0,
    }),
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      organizationId,
      position: 1,
    }),
  ]);

  return { chapter, course, lesson1, lesson2 };
}

const organization = await organizationFixture();

describe(listCurrentUserContinueLearningItems, () => {
  beforeEach(() => mockSession(null));

  describe("unauthenticated users", () => {
    it("returns empty array", async () => {
      const result = await listForUser(null);
      expect(result).toStrictEqual([]);
    });
  });

  describe("authenticated users", () => {
    it("returns empty array when user has no completions", async () => {
      const user = await userFixture();

      const result = await listForUser(user.id);
      expect(result).toStrictEqual([]);
    });

    it("ignores courses where the user started but did not complete a lesson", async () => {
      const user = await userFixture();

      const { course, lesson1 } = await createCourseWithLessons(organization.id);

      await Promise.all([
        prisma.courseUser.create({ data: { courseId: course.id, userId: user.id } }),
        lessonProgressFixture({
          completedAt: null,
          durationSeconds: null,
          lessonId: lesson1.id,
          userId: user.id,
        }),
      ]);

      const result = await listForUser(user.id);

      expect(result).toStrictEqual([]);
    });

    it("returns courses with next lesson info based on completions", async () => {
      const user = await userFixture();

      const { lesson1, lesson2, chapter, course } = await createCourseWithLessons(organization.id);

      await lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: lesson1.id,
        userId: user.id,
      });

      const result = await listForUser(user.id);

      expect(result).toHaveLength(1);

      expect(result[0]).toMatchObject({
        chapter: { id: chapter.id, title: chapter.title },
        course: { id: course.id },
        lesson: { id: lesson2.id },
        status: "ready",
      });
    });

    it("uses visible lesson kinds when choosing the next home continue target", async () => {
      const [user, course] = await Promise.all([
        userFixture(),
        courseFixture({ isPublished: true, organizationId: organization.id }),
      ]);

      const chapter = await chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      });

      const [completedLesson, hiddenLesson, nextVisibleLesson] = await Promise.all([
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          kind: "explanation",
          organizationId: organization.id,
          position: 0,
        }),
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          kind: "quiz",
          organizationId: organization.id,
          position: 1,
        }),
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          kind: "explanation",
          organizationId: organization.id,
          position: 2,
        }),
      ]);

      await Promise.all([
        prisma.userLearningProfile.create({
          data: { preferences: { hiddenLessonKinds: ["quiz"] }, userId: user.id },
        }),
        lessonProgressFixture({
          completedAt: new Date("2024-01-01"),
          durationSeconds: 60,
          lessonId: completedLesson.id,
          userId: user.id,
        }),
      ]);

      const result = await listForUser(user.id);

      expect(result).toHaveLength(1);

      expect(result[0]).toMatchObject({
        chapter: { id: chapter.id, title: chapter.title },
        course: { id: course.id },
        lesson: { id: nextVisibleLesson.id },
        status: "ready",
      });

      expect(result[0]).not.toMatchObject({ lesson: { id: hiddenLesson.id } });
    });

    it("ignores a course whose only completion belongs to a hidden lesson kind", async () => {
      const [user, course] = await Promise.all([
        userFixture(),
        courseFixture({ isPublished: true, organizationId: organization.id }),
      ]);

      const chapter = await chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      });

      const [hiddenCompletedLesson] = await Promise.all([
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          kind: "quiz",
          organizationId: organization.id,
          position: 0,
        }),
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          kind: "explanation",
          organizationId: organization.id,
          position: 1,
        }),
      ]);

      await Promise.all([
        prisma.userLearningProfile.create({
          data: { preferences: { hiddenLessonKinds: ["quiz"] }, userId: user.id },
        }),
        lessonProgressFixture({
          completedAt: new Date(),
          durationSeconds: 60,
          lessonId: hiddenCompletedLesson.id,
          userId: user.id,
        }),
      ]);

      await expect(listForUser(user.id)).resolves.toStrictEqual([]);
    });

    it("uses an earlier ready lesson when the latest completion is at the end", async () => {
      const [user, course] = await Promise.all([
        userFixture(),
        courseFixture({ isPublished: true, organizationId: organization.id }),
      ]);

      const chapter = await chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      });

      const [earlierIncompleteLesson, completedAnchor] = await Promise.all([
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: organization.id,
          position: 0,
        }),
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: organization.id,
          position: 1,
        }),
      ]);

      await lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: completedAnchor.id,
        userId: user.id,
      });

      const result = await listForUser(user.id);

      expect(result).toMatchObject([
        {
          lesson: { id: earlierIncompleteLesson.id, position: earlierIncompleteLesson.position },
          status: "ready",
        },
      ]);
    });

    it("uses an earlier pending lesson when the latest completion is at the end", async () => {
      const [user, course] = await Promise.all([
        userFixture(),
        courseFixture({ isPublished: true, organizationId: organization.id }),
      ]);

      const chapter = await chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      });

      const [earlierPendingLesson, completedAnchor] = await Promise.all([
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "pending",
          isPublished: true,
          organizationId: organization.id,
          position: 0,
        }),
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: organization.id,
          position: 1,
        }),
      ]);

      await lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: completedAnchor.id,
        userId: user.id,
      });

      const result = await listForUser(user.id);

      expect(result).toMatchObject([
        { lesson: { id: earlierPendingLesson.id }, status: "pending" },
      ]);
    });

    it("advances from a historical anchor that is no longer published", async () => {
      const [user, course] = await Promise.all([
        userFixture(),
        courseFixture({ isPublished: true, organizationId: organization.id }),
      ]);

      const chapter = await chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      });

      const [unpublishedAnchor, nextPublishedLesson] = await Promise.all([
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: false,
          organizationId: organization.id,
          position: 0,
        }),
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: organization.id,
          position: 1,
        }),
      ]);

      await lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: unpublishedAnchor.id,
        userId: user.id,
      });

      const result = await listForUser(user.id);

      expect(result).toMatchObject([{ lesson: { id: nextPublishedLesson.id }, status: "ready" }]);
    });

    it("does not reopen a durably completed lesson after new lessons are added", async () => {
      const user = await userFixture();
      const userId = user.id;

      const course = await courseFixture({ isPublished: true, organizationId: organization.id });

      const chapter = await chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      });

      const [completedLesson, replacementSecondLesson, nextLesson] = await Promise.all([
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

      await Promise.all([
        lessonProgressFixture({
          completedAt: new Date(),
          durationSeconds: 60,
          lessonId: completedLesson.id,
          userId,
        }),
        lessonProgressFixture({
          completedAt: new Date(),
          durationSeconds: 60,
          lessonId: replacementSecondLesson.id,
          userId,
        }),
      ]);

      const result = await listForUser(user.id);

      expect(result).toHaveLength(1);

      expect(result[0]).toMatchObject({
        chapter: { id: chapter.id, title: chapter.title },
        course: { id: course.id },
        lesson: { id: nextLesson.id },
        status: "ready",
      });

      expect(result[0]).not.toMatchObject({ lesson: { id: replacementSecondLesson.id } });

      expect(completedLesson.id).not.toBe(nextLesson.id);
    });

    it("orders by most recent completion", async () => {
      const user = await userFixture();

      const data1 = await createCourseWithLessons(organization.id);
      const data2 = await createCourseWithLessons(organization.id);

      const now = new Date();

      await Promise.all([
        lessonProgressFixture({
          completedAt: new Date(now.getTime() - 1000),
          durationSeconds: 60,
          lessonId: data1.lesson1.id,
          userId: user.id,
        }),
        lessonProgressFixture({
          completedAt: now,
          durationSeconds: 60,
          lessonId: data2.lesson1.id,
          userId: user.id,
        }),
      ]);

      const result = await listForUser(user.id);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ course: { id: data2.course.id }, status: "ready" });
      expect(result[1]).toMatchObject({ course: { id: data1.course.id }, status: "ready" });
    });

    it("evaluates ten recent candidates and returns at most four items", async () => {
      const user = await userFixture();

      const courses = await Promise.all(
        Array.from({ length: 11 }, () => createCourseWithLessons(organization.id)),
      );

      const now = new Date();

      await Promise.all(
        courses.map((data, idx) =>
          lessonProgressFixture({
            completedAt: new Date(now.getTime() + idx * 1000),
            durationSeconds: 60,
            lessonId: data.lesson1.id,
            userId: user.id,
          }),
        ),
      );

      const result = await listForUser(user.id);

      expect(result).toHaveLength(MAX_CONTINUE_LEARNING_ITEMS);
    });

    it("filters out completed courses", async () => {
      const user = await userFixture();

      const { lesson1, lesson2 } = await createCourseWithLessons(organization.id);

      await Promise.all([
        lessonProgressFixture({
          completedAt: new Date("2024-01-01"),
          durationSeconds: 60,
          lessonId: lesson1.id,
          userId: user.id,
        }),
        lessonProgressFixture({
          completedAt: new Date("2024-01-02"),
          durationSeconds: 60,
          lessonId: lesson2.id,
          userId: user.id,
        }),
      ]);

      const result = await listForUser(user.id);

      expect(result).toStrictEqual([]);
    });

    it("filters out durably completed courses even when a new chapter is added later", async () => {
      const user = await userFixture();

      const course = await courseFixture({ isPublished: true, organizationId: organization.id });

      const [completedChapter, addedChapter] = await Promise.all([
        chapterFixture({
          courseId: course.id,
          isPublished: true,
          organizationId: organization.id,
          position: 0,
        }),
        chapterFixture({
          courseId: course.id,
          isPublished: true,
          organizationId: organization.id,
          position: 1,
        }),
      ]);

      const [completedLesson] = await Promise.all([
        lessonFixture({
          chapterId: completedChapter.id,
          isPublished: true,
          organizationId: organization.id,
          position: 0,
        }),
        lessonFixture({
          chapterId: addedChapter.id,
          isPublished: true,
          organizationId: organization.id,
          position: 0,
        }),
      ]);

      await Promise.all([
        lessonProgressFixture({
          completedAt: new Date(),
          durationSeconds: 60,
          lessonId: completedLesson.id,
          userId: user.id,
        }),
        prisma.courseCompletion.create({ data: { courseId: course.id, userId: user.id } }),
      ]);

      const result = await listForUser(user.id);

      expect(result).toStrictEqual([]);
    });

    it("finds lesson in next chapter when current chapter is complete", async () => {
      const user = await userFixture();

      const course = await courseFixture({ isPublished: true, organizationId: organization.id });

      const [chapter1, chapter2] = await Promise.all([
        chapterFixture({
          courseId: course.id,
          isPublished: true,
          organizationId: organization.id,
          position: 0,
        }),
        chapterFixture({
          courseId: course.id,
          isPublished: true,
          organizationId: organization.id,
          position: 1,
        }),
      ]);

      const [lesson1, lesson2] = await Promise.all([
        lessonFixture({
          chapterId: chapter1.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: organization.id,
          position: 0,
        }),
        lessonFixture({
          chapterId: chapter2.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: organization.id,
          position: 0,
        }),
      ]);

      await lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: lesson1.id,
        userId: user.id,
      });

      const result = await listForUser(user.id);

      expect(result).toHaveLength(1);

      expect(result[0]).toMatchObject({
        chapter: { id: chapter2.id, title: chapter2.title },
        lesson: { id: lesson2.id },
        status: "ready",
      });
    });

    it("excludes courses from non-brand organizations", async () => {
      const user = await userFixture();

      const schoolOrg = await organizationFixture({ kind: "school" });
      const { lesson1, lesson2 } = await createCourseWithLessons(schoolOrg.id);

      await Promise.all([
        lessonProgressFixture({
          completedAt: new Date(),
          durationSeconds: 60,
          lessonId: lesson1.id,
          userId: user.id,
        }),
        lessonProgressFixture({
          completedAt: new Date(),
          durationSeconds: 60,
          lessonId: lesson2.id,
          userId: user.id,
        }),
      ]);

      const result = await listForUser(user.id);

      expect(result).toStrictEqual([]);
    });

    it("returns null organization for personal courses", async () => {
      const user = await userFixture();

      const course = await courseFixture({
        format: "question",
        isPublished: true,
        organizationId: null,
        userId: user.id,
      });

      const chapter = await chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: null,
        position: 0,
      });

      const [lesson1, lesson2] = await Promise.all([
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: null,
          position: 0,
        }),
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: null,
          position: 1,
        }),
      ]);

      await lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: lesson1.id,
        userId: user.id,
      });

      const result = await listForUser(user.id);

      expect(result).toHaveLength(1);

      expect(result[0]).toMatchObject({
        course: { id: course.id, organization: null },
        lesson: { id: lesson2.id },
        status: "ready",
      });
    });

    it("returns pending item when next lesson has no generated lessons", async () => {
      const user = await userFixture();

      const course = await courseFixture({ isPublished: true, organizationId: organization.id });

      const chapter = await chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      });

      const lesson1 = await lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      });

      const lesson2 = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      });

      await lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: lesson1.id,
        userId: user.id,
      });

      const result = await listForUser(user.id);

      expect(result).toHaveLength(1);

      expect(result[0]).toMatchObject({
        chapter: { id: chapter.id, slug: chapter.slug, title: chapter.title },
        course: { id: course.id },
        lesson: { id: lesson2.id, slug: lesson2.slug, title: lesson2.title },
        status: "pending",
      });
    });

    it("returns the pending tree-next lesson before a later generated lesson", async () => {
      const user = await userFixture();

      const course = await courseFixture({ isPublished: true, organizationId: organization.id });

      const chapter = await chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      });

      const [completedLesson, pendingLesson] = await Promise.all([
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: organization.id,
          position: 0,
        }),
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "pending",
          isPublished: true,
          organizationId: organization.id,
          position: 1,
        }),
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          kind: "practice",
          organizationId: organization.id,
          position: 2,
        }),
      ]);

      await lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: completedLesson.id,
        userId: user.id,
      });

      const result = await listForUser(user.id);

      expect(result).toHaveLength(1);

      expect(result[0]).toMatchObject({
        chapter: { id: chapter.id, slug: chapter.slug, title: chapter.title },
        course: { id: course.id },
        lesson: { id: pendingLesson.id, slug: pendingLesson.slug, title: pendingLesson.title },
        status: "pending",
      });
    });

    it("returns the next pending lesson target after the completed lesson", async () => {
      const user = await userFixture();

      const course = await courseFixture({ isPublished: true, organizationId: organization.id });

      const chapter = await chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      });

      const [, completedLesson, nextLesson] = await Promise.all([
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: organization.id,
          position: 0,
        }),
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: organization.id,
          position: 1,
        }),
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "pending",
          isPublished: true,
          organizationId: organization.id,
          position: 2,
        }),
      ]);

      await lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: completedLesson.id,
        userId: user.id,
      });

      const result = await listForUser(user.id);

      expect(result).toHaveLength(1);

      expect(result[0]).toMatchObject({
        chapter: { id: chapter.id, slug: chapter.slug, title: chapter.title },
        course: { id: course.id },
        lesson: { id: nextLesson.id, slug: nextLesson.slug, title: nextLesson.title },
        status: "pending",
      });
    });

    it("returns pending item linking to chapter when no next published lesson", async () => {
      const user = await userFixture();

      const course = await courseFixture({ isPublished: true, organizationId: organization.id });

      const chapter1 = await chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      });

      const chapter2 = await chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      });

      const lesson = await lessonFixture({
        chapterId: chapter1.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      });

      await lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: lesson.id,
        userId: user.id,
      });

      const result = await listForUser(user.id);

      expect(result).toHaveLength(1);

      expect(result[0]).toMatchObject({
        chapter: { id: chapter2.id, slug: chapter2.slug, title: chapter2.title },
        course: { id: course.id },
        lesson: null,
        status: "pending",
      });
    });
  });
});
