import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { replaceCourseCurriculum, withCurrentCourseRevision } from "./course-curriculum";

const outline = [
  {
    description: "Understand one useful idea",
    key: "answer",
    level: null,
    outcomes: ["Explain the answer"],
    title: "The answer",
  },
];

describe("curriculum replacement", () => {
  it("keeps completed learning and attempts after removing obsolete content", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ format: "question", generationRunId: "replacement" }),
    ]);

    const chapter = await chapterFixture({ courseId: course.id });
    const lesson = await lessonFixture({ chapterId: chapter.id });
    const step = await stepFixture({ lessonId: lesson.id });
    const completedAt = new Date("2026-09-01T12:00:00Z");

    const history = await lessonProgressFixture({
      completedAt,
      durationSeconds: 93,
      lessonId: lesson.id,
      userId: user.id,
    });

    const attempt = await prisma.stepAttempt.create({
      data: {
        answer: {},
        correctAnswers: 2,
        dayOfWeek: 2,
        durationSeconds: 12,
        hourOfDay: 9,
        incorrectAnswers: 1,
        isCorrect: false,
        stepId: step.id,
        userId: user.id,
      },
    });

    await expect(
      replaceCourseCurriculum({
        chapters: outline,
        context: { contentRevision: 1, courseId: course.id, workflowRunId: "replacement" },
        curriculumVersion: 2,
      }),
    ).resolves.toMatchObject({ contentRevision: 2, status: "replaced" });

    await expect(
      prisma.lessonProgress.findUnique({ where: { id: history.id } }),
    ).resolves.toMatchObject({
      completedAt,
      contentSnapshot: { courseId: course.id, lessonId: lesson.id },
      durationSeconds: 93,
      lessonId: null,
    });

    await expect(
      prisma.stepAttempt.findUnique({ where: { id: attempt.id } }),
    ).resolves.toMatchObject({ correctAnswers: 2, incorrectAnswers: 1, stepId: null });

    await expect(prisma.chapter.count({ where: { courseId: course.id } })).resolves.toBe(1);
  });

  it("makes replacement idempotent and rejects a stale image or lesson writer", async () => {
    const course = await courseFixture({ format: "question", generationRunId: "replacement" });
    const context = { contentRevision: 1, courseId: course.id, workflowRunId: "replacement" };

    const results = await Promise.all([
      replaceCourseCurriculum({ chapters: outline, context, curriculumVersion: 2 }),
      replaceCourseCurriculum({ chapters: outline, context, curriculumVersion: 2 }),
    ]);

    expect(results.map((result) => result.status).toSorted()).toStrictEqual([
      "replaced",
      "replaced",
    ]);

    expect(results[0]).toStrictEqual(results[1]);

    await expect(
      replaceCourseCurriculum({
        chapters: [{ ...outline[0]!, title: "A different outline" }],
        context,
        curriculumVersion: 2,
      }),
    ).resolves.toStrictEqual({ status: "superseded" });

    await expect(
      withCurrentCourseRevision({
        context,
        operation: (transaction) =>
          transaction.course.update({ data: { imageUrl: "old-image" }, where: { id: course.id } }),
      }),
    ).resolves.toStrictEqual({ status: "superseded" });

    const replacedCourse = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });
    expect(replacedCourse.imageUrl).toBeNull();
  });

  it("leaves the old curriculum unchanged when the replacement outline is invalid", async () => {
    const course = await courseFixture({ format: "core" });
    const chapter = await chapterFixture({ courseId: course.id });

    await expect(
      replaceCourseCurriculum({
        chapters: outline,
        context: { contentRevision: 1, courseId: course.id },
        curriculumVersion: 2,
      }),
    ).rejects.toThrow("missing a required level");

    await expect(prisma.chapter.findUnique({ where: { id: chapter.id } })).resolves.not.toBeNull();
  });
});
