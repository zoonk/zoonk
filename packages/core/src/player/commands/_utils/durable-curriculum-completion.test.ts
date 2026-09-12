import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { syncDurableCurriculumCompletion } from "./durable-curriculum-completion";

async function completeLesson(lessonId: string, userId: string) {
  await lessonProgressFixture({ completedAt: new Date(), durationSeconds: 60, lessonId, userId });
  return prisma.$transaction((tx) => syncDurableCurriculumCompletion(tx, { lessonId, userId }));
}

describe("current curriculum durable completion", () => {
  it("earns the course badge for comprehensive teaching, without requiring overview or optional practice", async () => {
    const [organization, user] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      userFixture(),
    ]);

    const course = await courseFixture({
      curriculumVersion: 2,
      isPublished: true,
      organizationId: organization.id,
    });

    const common = { courseId: course.id, isPublished: true, organizationId: organization.id };

    const [overview, basic] = await Promise.all([
      chapterFixture({ ...common, level: "overview", position: 0 }),
      chapterFixture({ ...common, level: "basic", position: 1 }),
    ]);

    const lessons = { isPublished: true, organizationId: organization.id };

    const [summary, teaching] = await Promise.all([
      lessonFixture({ ...lessons, chapterId: overview.id }),
      lessonFixture({ ...lessons, chapterId: basic.id, position: 0 }),
      lessonFixture({ ...lessons, chapterId: basic.id, kind: "practice", position: 1 }),
    ]);

    await completeLesson(summary.id, user.id);

    await expect(
      prisma.chapterCompletion.count({ where: { chapterId: overview.id, userId: user.id } }),
    ).resolves.toBe(1);

    await expect(
      prisma.courseCompletion.count({ where: { courseId: course.id, userId: user.id } }),
    ).resolves.toBe(0);

    await completeLesson(teaching.id, user.id);

    await expect(
      prisma.courseCompletion.count({ where: { courseId: course.id, userId: user.id } }),
    ).resolves.toBe(1);

    await expect(
      prisma.chapterCompletion.count({ where: { chapterId: basic.id, userId: user.id } }),
    ).resolves.toBe(1);
  });

  it("does not use a historical chapter badge to skip new required material", async () => {
    const [organization, user] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      userFixture(),
    ]);

    const course = await courseFixture({
      curriculumVersion: 2,
      isPublished: true,
      organizationId: organization.id,
    });

    const common = { courseId: course.id, isPublished: true, organizationId: organization.id };

    const [earlier, later] = await Promise.all([
      chapterFixture({ ...common, level: "basic", position: 0 }),
      chapterFixture({ ...common, level: "intermediate", position: 1 }),
    ]);

    const [, teaching] = await Promise.all([
      lessonFixture({ chapterId: earlier.id, isPublished: true, organizationId: organization.id }),
      lessonFixture({ chapterId: later.id, isPublished: true, organizationId: organization.id }),
      prisma.chapterCompletion.create({ data: { chapterId: earlier.id, userId: user.id } }),
    ]);

    await completeLesson(teaching.id, user.id);

    await expect(
      prisma.courseCompletion.count({ where: { courseId: course.id, userId: user.id } }),
    ).resolves.toBe(0);

    await expect(
      prisma.chapterCompletion.count({ where: { chapterId: earlier.id, userId: user.id } }),
    ).resolves.toBe(1);
  });

  it("excludes another learner's private curriculum from completion writes", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);

    const course = await courseFixture({
      curriculumVersion: 2,
      format: "personalized",
      isPublished: true,
      userId: owner.id,
    });

    const chapter = await chapterFixture({ courseId: course.id, isPublished: true });
    const lesson = await lessonFixture({ chapterId: chapter.id, isPublished: true });

    await expect(
      prisma.$transaction((tx) =>
        syncDurableCurriculumCompletion(tx, { lessonId: lesson.id, userId: other.id }),
      ),
    ).rejects.toThrow("Lesson is not completable");

    await completeLesson(lesson.id, owner.id);

    await expect(
      prisma.courseCompletion.count({ where: { courseId: course.id, userId: owner.id } }),
    ).resolves.toBe(1);

    await expect(
      prisma.courseCompletion.count({ where: { courseId: course.id, userId: other.id } }),
    ).resolves.toBe(0);
  });
});
