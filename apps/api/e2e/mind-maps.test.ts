import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import {
  chapterMindMapSchema,
  chapterMindMapStatusSchema,
  goalMindMapGenerationsSchema,
  goalMindMapsSchema,
  savedMindMapStateSchema,
} from "@zoonk/core/mind-maps/contract";
import { chapterLessonMapsSchema } from "@zoonk/core/mind-maps/lesson-maps-contract";
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

const STRUCTURE = {
  branches: ["Nucleus", "Membrane", "Mitochondria"].map((title) => ({
    drawing: title,
    explanation: `What the ${title} does`,
    points: [title],
    title,
  })),
  centralIdea: "A cell is made of parts",
  comparison: null,
  summary: "Each part of a cell has a job",
  title: "Cell parts",
};

async function createGoal(userId: string) {
  const suffix = randomUUID().slice(0, 6);

  const [goal, finished, current, finishedLesson, currentLesson, skills] = await Promise.all([
    goalFixture({ displayName: "Cell biology", title: "Cells", userId }),
    libraryChapterFixture({ title: `Cell parts ${suffix}` }),
    libraryChapterFixture({ title: `Cell energy ${suffix}` }),
    libraryLessonFixture({ contentStatus: "completed" }),
    libraryLessonFixture(),
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

  return { current, currentLesson, finished, finishedLesson, goal };
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

  test("makes any chapter's map on request, writing its lessons first, and lists every chapter", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "mind-map-make",
    });

    const { current, currentLesson, finished, goal } = await createGoal(user.id);
    const finishedPath = `/v1/goals/${goal.id}/chapters/${finished.id}/mind-map`;
    const currentPath = `/v1/goals/${goal.id}/chapters/${current.id}/mind-map`;

    const listed = (status: { current: string; finished: string }) => {
      const before = status.finished === "available";

      return {
        chapters: [
          {
            chapterId: finished.id,
            image: null,
            lessonsToWrite: 0,
            outline: null,
            position: 1,
            saved: false,
            status: status.finished,
            subject: null,
            title: finished.title,
          },
          {
            chapterId: current.id,
            image: null,
            lessonsToWrite: 1,
            outline: null,
            position: 2,
            saved: false,
            status: status.current,
            subject: null,
            title: current.title,
          },
        ],
        createOffer: {
          eligible: before ? 1 : 0,
          needLessons: before ? 1 : 0,
          startable: before ? 1 : 0,
          stop: null,
        },
        firstTab: "chapters",
        goal: { displayName: "Cell biology", id: goal.id, title: "Cells" },
        lessonGroups: [],
        saved: [],
      };
    };

    await expect(
      readBody({ response: await apiContext.get(finishedPath), schema: chapterMindMapSchema }),
    ).resolves.toStrictEqual({
      chapterId: finished.id,
      image: null,
      lessonsToWrite: 0,
      outline: null,
      position: 1,
      saved: false,
      status: "available",
      title: finished.title,
    });

    await expect(
      readBody({
        response: await apiContext.get(`/v1/goals/${goal.id}/mind-maps`),
        schema: goalMindMapsSchema,
      }),
    ).resolves.toStrictEqual(listed({ current: "available", finished: "available" }));

    await expect(
      readBody({
        response: await apiContext.post(`${currentPath}/generations`),
        schema: mindMapGenerationSchema,
        status: ACCEPTED,
      }),
    ).resolves.toStrictEqual({ generationId: null, status: "writingLessons" });

    await expect(
      readBody({
        response: await apiContext.post(`${finishedPath}/generations`),
        schema: mindMapGenerationSchema,
        status: ACCEPTED,
      }),
    ).resolves.toStrictEqual({ generationId: null, status: "drawing" });

    await expect(
      readBody({
        response: await apiContext.post(`${finishedPath}/generations`),
        schema: mindMapGenerationSchema,
        status: ACCEPTED,
      }),
    ).resolves.toMatchObject({ status: "drawing" });

    const claimed = await prisma.usageRecord.findMany({
      select: { kind: true, targetId: true },
      where: { userId: user.id },
    });

    expect(claimed.toSorted((a, b) => a.targetId.localeCompare(b.targetId))).toStrictEqual(
      [
        { kind: "lessonStart", targetId: currentLesson.id },
        { kind: "mindMap", targetId: current.id },
        { kind: "mindMap", targetId: finished.id },
      ].toSorted((a, b) => a.targetId.localeCompare(b.targetId)),
    );

    await expect(
      readBody({
        response: await apiContext.get(`${finishedPath}/status`),
        schema: chapterMindMapStatusSchema,
      }),
    ).resolves.toStrictEqual({ status: "drawing" });

    await expect(
      readBody({
        response: await apiContext.get(`/v1/goals/${goal.id}/mind-maps`),
        schema: goalMindMapsSchema,
      }),
    ).resolves.toStrictEqual(listed({ current: "writingLessons", finished: "drawing" }));

    await apiContext.dispose();
  });

  test("makes every chapter map at once, lists lesson maps, and saves a ready map", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "mind-map-study",
    });

    const { current, finished, finishedLesson, goal } = await createGoal(user.id);
    const lessonMap = { ideas: [{ text: "A cell has parts." }] };

    await prisma.lesson.update({ data: { summary: lessonMap }, where: { id: finishedLesson.id } });

    await expect(
      readBody({
        response: await apiContext.get(`/v1/goals/${goal.id}/chapters/${finished.id}/lesson-maps`),
        schema: chapterLessonMapsSchema,
      }),
    ).resolves.toStrictEqual({
      chapter: { id: finished.id, position: 1, title: finished.title },
      lessons: [
        {
          lessonId: finishedLesson.id,
          map: { ideas: [{ about: null, icon: null, text: "A cell has parts." }], shape: "hub" },
          position: 1,
          saved: false,
          title: finishedLesson.title,
        },
      ],
    });

    await expect(
      readBody({
        response: await apiContext.post(`/v1/goals/${goal.id}/mind-maps/generations`),
        schema: goalMindMapGenerationsSchema,
        status: ACCEPTED,
      }),
    ).resolves.toStrictEqual({
      accepted: [finished.id],
      joined: [],
      stop: null,
      unstarted: [{ chapterId: current.id, reason: "needsLessons" }],
    });

    await prisma.chapterMindMap.update({
      data: { status: "completed", structure: STRUCTURE },
      where: { chapterId: finished.id },
    });

    const saving = { kind: "chapter", saved: true, targetId: finished.id };

    await expect(
      readBody({
        response: await apiContext.post(`/v1/goals/${goal.id}/mind-maps/saved`, { data: saving }),
        schema: savedMindMapStateSchema,
      }),
    ).resolves.toStrictEqual(saving);

    await expect(
      readBody({
        response: await apiContext.get(`/v1/goals/${goal.id}/mind-maps`),
        schema: goalMindMapsSchema,
      }),
    ).resolves.toMatchObject({
      lessonGroups: [{ chapterId: finished.id, count: 1, lessonIds: [finishedLesson.id] }],
      saved: [
        {
          available: true,
          chapterId: finished.id,
          kind: "chapter",
          targetId: finished.id,
          title: finished.title,
        },
      ],
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
