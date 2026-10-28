import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { chapterMindMapSchema, goalMindMapsSchema } from "@zoonk/core/mind-maps/contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillsFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { mindMapGenerationSchema } from "../src/lib/openapi/schemas/mind-maps";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { readBody } from "./helpers/response";

const ACCEPTED = 202;
const PAYMENT_REQUIRED = 402;
const UNPROCESSABLE = 422;

async function createGoal(userId: string) {
  const suffix = randomUUID().slice(0, 6);

  const [goal, finished, current, finishedLesson, currentLesson, skills] = await Promise.all([
    goalFixture({ title: "Cells", userId }),
    libraryChapterFixture({ title: `Cell parts ${suffix}` }),
    libraryChapterFixture({ title: `Cell energy ${suffix}` }),
    libraryLessonFixture({ contentStatus: "completed" }),
    libraryLessonFixture({ contentStatus: "completed" }),
    skillsFixture([`Cell parts ${suffix}`, `Cell energy ${suffix}`]),
  ]);

  const [partsSkill, energySkill] = skills;

  await Promise.all([
    chapterLessonFixture({ chapterId: finished.id, lessonId: finishedLesson.id, position: 0 }),
    chapterLessonFixture({ chapterId: current.id, lessonId: currentLesson.id, position: 0 }),
    lessonSkillFixture({ lessonId: finishedLesson.id, skillId: partsSkill?.id ?? "" }),
    lessonSkillFixture({ lessonId: currentLesson.id, skillId: energySkill?.id ?? "" }),
    planFixture({
      goalId: goal.id,
      items: [
        {
          chapterId: finished.id,
          completedAt: new Date(),
          lessonId: finishedLesson.id,
          skillId: partsSkill?.id ?? null,
          status: "done",
        },
        { chapterId: current.id, lessonId: currentLesson.id, skillId: energySkill?.id ?? null },
      ],
    }),
  ]);

  return { current, finished, goal };
}

test.describe("Mind maps API", () => {
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
    const chapterId = randomUUID();

    const statuses = await Promise.all([
      anonymous.get(`/v1/goals/${goalId}/mind-maps`),
      anonymous.get(`/v1/goals/${goalId}/chapters/${chapterId}/mind-map`),
      anonymous.post(`/v1/goals/${goalId}/chapters/${chapterId}/mind-map/generations`),
    ]);

    expect(statuses.map((response) => response.status())).toStrictEqual([401, 401, 401]);

    const { apiContext } = await createAuthenticatedApiContext({ baseURL, prefix: "mind-map-own" });
    const stranger = await userFixture();
    const other = await createGoal(stranger.id);

    const hidden = await Promise.all([
      apiContext.get(`/v1/goals/${other.goal.id}/mind-maps`),
      apiContext.get(`/v1/goals/${other.goal.id}/chapters/${other.finished.id}/mind-map`),
      apiContext.post(
        `/v1/goals/${other.goal.id}/chapters/${other.finished.id}/mind-map/generations`,
      ),
    ]);

    expect(hidden.map((response) => response.status())).toStrictEqual([404, 404, 404]);
    await Promise.all([anonymous.dispose(), apiContext.dispose()]);
  });

  test("makes a finished chapter's map on request, once, and lists the goal's maps", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "mind-map-make",
    });

    const { current, finished, goal } = await createGoal(user.id);
    const chapterPath = `/v1/goals/${goal.id}/chapters/${finished.id}/mind-map`;

    await expect(
      readBody({ response: await apiContext.get(chapterPath), schema: chapterMindMapSchema }),
    ).resolves.toStrictEqual({
      chapterId: finished.id,
      image: null,
      outline: null,
      position: 1,
      status: "available",
      title: finished.title,
    });

    const notYet = await apiContext.post(
      `/v1/goals/${goal.id}/chapters/${current.id}/mind-map/generations`,
    );

    expect(notYet.status()).toBe(UNPROCESSABLE);

    const started = await apiContext.post(`${chapterPath}/generations`);

    const body = await readBody({
      response: started,
      schema: mindMapGenerationSchema,
      status: ACCEPTED,
    });

    expect(body).toStrictEqual({ generationId: expect.any(String), status: "generating" });
    expect(started.headers().location).toBe(`/v1/generations/${body.generationId}`);

    await expect(
      readBody({
        response: await apiContext.post(`${chapterPath}/generations`),
        schema: mindMapGenerationSchema,
        status: ACCEPTED,
      }),
    ).resolves.toMatchObject({ status: "generating" });

    await expect(
      prisma.usageRecord.findMany({
        select: { kind: true, targetId: true },
        where: { userId: user.id },
      }),
    ).resolves.toStrictEqual([{ kind: "mindMap", targetId: finished.id }]);

    await expect(
      readBody({
        response: await apiContext.get(`/v1/goals/${goal.id}/mind-maps`),
        schema: goalMindMapsSchema,
      }),
    ).resolves.toStrictEqual({
      chapters: [
        {
          chapterId: finished.id,
          image: null,
          outline: null,
          position: 1,
          status: expect.stringMatching(/^generating$|^failed$/u),
          subject: null,
          title: finished.title,
        },
      ],
      goal: { id: goal.id, title: "Cells" },
      nextChapter: { chapterId: current.id, lessonsLeft: 1, title: current.title },
    });

    await apiContext.dispose();
  });

  test("refuses a free learner's new map once they made the day's maps", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "mind-map-limit",
    });

    const { finished, goal } = await createGoal(user.id);

    await prisma.usageRecord.createMany({
      data: [1, 2, 3].map(() => ({
        generated: true,
        kind: "mindMap" as const,
        targetId: randomUUID(),
        userId: user.id,
      })),
    });

    const refused = await apiContext.post(
      `/v1/goals/${goal.id}/chapters/${finished.id}/mind-map/generations`,
    );

    expect(refused.status()).toBe(PAYMENT_REQUIRED);

    await expect(refused.json()).resolves.toMatchObject({
      error: {
        code: "USAGE_LIMIT_REACHED",
        details: { limit: { limit: 3, period: "day", resource: "mindMap", tier: "free" } },
      },
    });

    await expect(prisma.chapterMindMap.count({ where: { chapterId: finished.id } })).resolves.toBe(
      0,
    );

    await apiContext.dispose();
  });
});
