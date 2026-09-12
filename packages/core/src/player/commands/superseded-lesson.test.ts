import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { getSession } from "../../users/get-session";
import { replaceCourseCurriculum } from "../../workflows/internal/course-curriculum";
import { completeLesson } from "./create-lesson-completion";
import { startLesson } from "./start-lesson";
import { LessonSupersededError, submitLessonCompletion } from "./submit-lesson-completion";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

describe("superseded-lesson.test", () => {
  it("keeps an authenticated start snapshot and returns a recoverable superseded response without accepting deleted answers", async () => {
    const [user, organization] = await Promise.all([userFixture(), organizationFixture()]);
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

    const course = await courseFixture({
      format: "question",
      isPublished: true,
      organizationId: organization.id,
    });

    const chapter = await chapterFixture({ courseId: course.id, isPublished: true });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
    });

    await expect(startLesson(lesson.id)).resolves.toStrictEqual({ status: "started" });

    await replaceCourseCurriculum({
      chapters: [
        {
          description: "An improved explanation",
          key: "new",
          level: null,
          outcomes: [],
          title: "New answer",
        },
      ],
      context: { contentRevision: 1, courseId: course.id },
      curriculumVersion: 2,
    });

    await expect(
      completeLesson({
        answers: {},
        lessonId: lesson.id,
        startedAt: Date.now() - 5000,
        stepTimings: {},
        timeZone: "UTC",
      }),
    ).resolves.toStrictEqual({ courseId: course.id, status: "superseded" });

    await expect(
      prisma.lessonProgress.findFirst({ where: { userId: user.id } }),
    ).resolves.toMatchObject({
      completedAt: null,
      contentSnapshot: { courseId: course.id, lessonId: lesson.id },
      lessonId: null,
    });

    await expect(prisma.stepAttempt.count({ where: { userId: user.id } })).resolves.toBe(0);

    await expect(
      submitLessonCompletion({
        courseRevision: { contentRevision: 1, courseId: course.id },
        durationSeconds: 5,
        lessonId: lesson.id,
        score: { brainPower: 0, correctCount: 0, energyDelta: 0, incorrectCount: 0 },
        startedAt: new Date(),
        stepResults: [],
        timeZone: "UTC",
        userId: user.id,
      }),
    ).rejects.toBeInstanceOf(LessonSupersededError);
  });

  it("cannot create enrollment or progress in another learner's private course", async () => {
    const [owner, viewer] = await Promise.all([userFixture(), userFixture()]);

    const course = await courseFixture({
      format: "personalized",
      isPublished: true,
      userId: owner.id,
    });

    const chapter = await chapterFixture({ courseId: course.id, isPublished: true });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
    });

    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user: viewer });
    await expect(startLesson(lesson.id)).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      prisma.courseUser.count({ where: { courseId: course.id, userId: viewer.id } }),
    ).resolves.toBe(0);
  });
});
