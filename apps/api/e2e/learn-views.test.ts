import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { areaPracticeResponseSchema } from "../src/lib/openapi/schemas/learn-views";
import { createAuthenticatedApiContext } from "./helpers/auth";

async function createGoal(userId: string) {
  const [goal, chapter, skill] = await Promise.all([
    goalFixture({ title: "Percentages for the exam", userId }),
    libraryChapterFixture({ title: "Percentages" }),
    skillFixture({ name: "Percentages" }),
  ]);

  const lesson = await libraryLessonFixture({ homeChapterId: chapter.id });

  await Promise.all([
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    planFixture({
      goalId: goal.id,
      items: [
        {
          chapterId: chapter.id,
          lessonId: lesson.id,
          skillId: skill.id,
          titleSnapshot: lesson.title,
        },
      ],
    }),
  ]);

  return { chapter, goal };
}

test.describe("Learning tab views API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication and hides other learners' goals", async () => {
    const anonymous = await request.newContext({ baseURL });
    const goalId = randomUUID();

    const unauthorized = await Promise.all([
      anonymous.get(`/v1/goals/${goalId}/progress`),
      anonymous.get(`/v1/goals/${goalId}/content`),
      anonymous.get(`/v1/goals/${goalId}/syllabus`),
      anonymous.post(`/v1/goals/${goalId}/area-practice`, { data: { areaId: "any" } }),
    ]);

    expect(unauthorized.map((response) => response.status())).toStrictEqual([401, 401, 401, 401]);
    await anonymous.dispose();

    const [{ apiContext }, owner] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "learn-views-hidden" }),
      userFixture(),
    ]);

    const { goal } = await createGoal(owner.id);

    const [progress, content, syllabus, invalid] = await Promise.all([
      apiContext.get(`/v1/goals/${goal.id}/progress`),
      apiContext.get(`/v1/goals/${goal.id}/content`),
      apiContext.get(`/v1/goals/${goal.id}/syllabus`),
      apiContext.get("/v1/goals/not-a-uuid/syllabus"),
    ]);

    expect(
      [progress, content, syllabus, invalid].map((response) => response.status()),
    ).toStrictEqual([404, 404, 404, 400]);

    await apiContext.dispose();
  });

  test("adds area practice to today's session, and a second tap returns the same block", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "learn-views-practice",
    });

    const { chapter, goal } = await createGoal(user.id);

    const invalid = await apiContext.post(`/v1/goals/${goal.id}/area-practice`, { data: {} });
    expect(invalid.status()).toBe(400);

    const missing = await apiContext.post(`/v1/goals/${goal.id}/area-practice`, {
      data: { areaId: "not-an-area", timeZone: "UTC" },
    });

    expect(missing.status()).toBe(404);

    const first = await apiContext.post(`/v1/goals/${goal.id}/area-practice`, {
      data: { areaId: chapter.id, timeZone: "UTC" },
    });

    expect(first.status()).toBe(201);

    const created = areaPracticeResponseSchema.parse(await first.json());
    expect(created.block.extra).toBe(true);

    const again = await apiContext.post(`/v1/goals/${goal.id}/area-practice`, {
      data: { areaId: chapter.id, timeZone: "UTC" },
    });

    expect(areaPracticeResponseSchema.parse(await again.json()).block.id).toBe(created.block.id);
    await apiContext.dispose();
  });
});
