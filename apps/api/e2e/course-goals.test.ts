import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { goalSchema } from "../src/lib/openapi/schemas/goals";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { readBody } from "./helpers/response";

/** A published course with two Beginner chapters of two one-skill lessons each. */
async function createOutlinedCourse() {
  const course = await courseFixture({
    isPublished: true,
    title: `Robotics ${randomUUID()}`,
    visibility: "public",
  });

  const chapters = await Promise.all(
    ["What robots are made of", "How robots decide"].map(async (title, position) => {
      const chapter = await libraryChapterFixture({ title });
      await courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position });
      return chapter;
    }),
  );

  await Promise.all(
    chapters.flatMap((chapter, chapterIndex) =>
      [0, 1].map(async (position) => {
        const [lesson, skill] = await Promise.all([
          libraryLessonFixture({ estimatedMinutes: 3, homeChapterId: chapter.id }),
          skillFixture({ name: `Skill ${chapterIndex + 1}.${position + 1}` }),
        ]);

        await Promise.all([
          chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
          lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
        ]);
      }),
    ),
  );

  return { chapters, course };
}

async function countPlanLessons(goalId: string) {
  return prisma.planItem.count({ where: { kind: "lesson", plan: { goalId } } });
}

test.describe("Course goals API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("needs a session", async () => {
    const [anonymous, { course }] = await Promise.all([
      request.newContext({ baseURL }),
      createOutlinedCourse(),
    ]);

    const response = await anonymous.post(`/v1/courses/${course.id}/goals`, { data: {} });

    expect(response.status()).toBe(401);
    await anonymous.dispose();
  });

  test("starts a course as a goal with its plan, and gives the same goal back after", async () => {
    const [{ apiContext, user }, { course }] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "course-goal" }),
      createOutlinedCourse(),
    ]);

    const created = await readBody({
      response: await apiContext.post(`/v1/courses/${course.id}/goals`, {
        data: { dailyMinutes: 20, timeZone: "America/Sao_Paulo" },
      }),
      schema: goalSchema,
      status: 201,
    });

    expect(created).toMatchObject({
      dailyMinutes: 20,
      details: { courseStart: { chapterId: null } },
      kind: "learn",
      plan: { phaseCount: 1, ready: true },
      primaryCourseId: course.id,
      title: course.title,
    });

    await expect(countPlanLessons(created.id)).resolves.toBe(4);

    const again = await readBody({
      response: await apiContext.post(`/v1/courses/${course.id}/goals`, { data: {} }),
      schema: goalSchema,
    });

    expect(again.id).toBe(created.id);
    await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(1);
    await apiContext.dispose();
  });

  test("starts the plan at a chapter of the course", async () => {
    const [{ apiContext }, { chapters, course }, other] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "course-chapter" }),
      createOutlinedCourse(),
      createOutlinedCourse(),
    ]);

    const [, second] = chapters;

    const foreign = await apiContext.post(`/v1/courses/${course.id}/goals`, {
      data: { chapterId: other.chapters[0]?.id },
    });

    expect(foreign.status()).toBe(404);

    const started = await readBody({
      response: await apiContext.post(`/v1/courses/${course.id}/goals`, {
        data: { chapterId: second?.id },
      }),
      schema: goalSchema,
      status: 201,
    });

    expect(started.details).toStrictEqual({ courseStart: { chapterId: second?.id } });
    await expect(countPlanLessons(started.id)).resolves.toBe(2);
    await apiContext.dispose();
  });

  test("hides courses the learner can't start and keeps the goal limits", async () => {
    const [{ apiContext, user }, { course }, owner] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "course-limits" }),
      createOutlinedCourse(),
      userFixture(),
    ]);

    const privateCourse = await courseFixture({ userId: owner.id, visibility: "private" });

    const [hidden, unknown, invalid] = await Promise.all([
      apiContext.post(`/v1/courses/${privateCourse.id}/goals`, { data: {} }),
      apiContext.post(`/v1/courses/${randomUUID()}/goals`, { data: {} }),
      apiContext.post(`/v1/courses/${course.id}/goals`, { data: { dailyMinutes: 1 } }),
    ]);

    expect([hidden.status(), unknown.status(), invalid.status()]).toStrictEqual([404, 404, 400]);

    // The free plan follows one goal at a time.
    await goalFixture({ userId: user.id });

    const refused = await apiContext.post(`/v1/courses/${course.id}/goals`, { data: {} });

    expect(refused.status()).toBe(429);
    await expect(refused.json()).resolves.toMatchObject({ error: { code: "GOAL_LIMIT_REACHED" } });
    await apiContext.dispose();
  });
});
