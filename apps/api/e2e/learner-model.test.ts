import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  choiceItemContent,
  itemFixture,
  skillFixture,
  skillPrerequisiteFixture,
} from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import {
  chapterTestOutResponseSchema,
  chapterTestOutResultSchema,
  placementAnswerResponseSchema,
  placementCompletionResponseSchema,
  placementResponseSchema,
  testOutGenerationSchema,
} from "../src/lib/openapi/schemas/learner";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { createGuest } from "./helpers/bearer";
import { readBody } from "./helpers/response";

const SKILLS = 4;

/** A goal with one chapter of four chained skills, one plan item and one question per skill. */
async function createGoal(userId: string) {
  const [goal, chapter, skills] = await Promise.all([
    goalFixture({ userId }),
    libraryChapterFixture({ title: "Percentages" }),
    Promise.all(
      Array.from({ length: SKILLS }, (_, index) => skillFixture({ name: `Skill ${index + 1}` })),
    ),
  ]);

  const plan = await planFixture({ goalId: goal.id });

  await Promise.all([
    ...skills
      .slice(1)
      .map((skill, index) =>
        skillPrerequisiteFixture({ prerequisiteId: skills[index]?.id ?? "", skillId: skill.id }),
      ),
    ...skills.map((skill, position) =>
      planItemFixture({ chapterId: chapter.id, planId: plan.id, position, skillId: skill.id }),
    ),
  ]);

  const items = await Promise.all(
    skills.map((skill) => itemFixture({ content: choiceItemContent(), skillId: skill.id })),
  );

  return { chapter, goal, items, skills };
}

/** The goal's plan skills, which `createGoal` gives one question each. */
async function chapterSkillIds(goalId: string): Promise<string[]> {
  const items = await prisma.planItem.findMany({
    select: { skillId: true },
    where: { plan: { goalId } },
  });

  return items.flatMap((item) => item.skillId ?? []);
}

test.describe("Learner model API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication for every learner-model resource", async () => {
    const apiContext = await request.newContext({ baseURL });
    const goalId = randomUUID();

    const responses = await Promise.all([
      apiContext.get("/v1/me/skills"),
      apiContext.get("/v1/me/reviews"),
      apiContext.get("/v1/me/mistakes"),
      apiContext.get("/v1/me/mistake-practice"),
      apiContext.post(`/v1/me/mistakes/${randomUUID()}/answers`, {
        data: { answer: { selectedIndex: 0 }, durationMs: 1000, itemId: randomUUID() },
      }),
      apiContext.get(`/v1/goals/${goalId}/preparation`),
      apiContext.get(`/v1/goals/${goalId}/placement`),
      apiContext.post(`/v1/goals/${goalId}/placement/completion`, { data: {} }),
      apiContext.get(`/v1/goals/${goalId}/chapters/${randomUUID()}/test-out`),
      apiContext.post(`/v1/goals/${goalId}/chapters/${randomUUID()}/test-out/generations`),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual(responses.map(() => 401));
    await apiContext.dispose();
  });

  test("hides another learner's goal and validates ids", async () => {
    const [{ apiContext }, owner] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "learner-hidden" }),
      userFixture(),
    ]);

    const { goal } = await createGoal(owner.id);

    const [hidden, invalid] = await Promise.all([
      apiContext.get(`/v1/goals/${goal.id}/preparation`),
      apiContext.get("/v1/goals/not-a-uuid/placement"),
    ]);

    expect(hidden.status()).toBe(404);
    expect(invalid.status()).toBe(400);
    await apiContext.dispose();
  });

  test("runs placement from the first question to where each phase starts", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "learner-placement",
    });

    const { goal, skills } = await createGoal(user.id);

    const response = await apiContext.get(`/v1/goals/${goal.id}/placement?level=none`);
    const sent: unknown = await response.json();
    const placement = await readBody({ response, schema: placementResponseSchema });

    expect(placement).toMatchObject({
      complete: false,
      dayBudgetSpent: 0,
      dayBudgetUsed: false,
      started: false,
      status: "asking",
    });

    // The raw response carries the question and its options only: nothing that tells the answer.
    expect(Object.keys(placement.next ?? {}).toSorted()).toStrictEqual(
      Object.keys((sent as { next: object }).next).toSorted(),
    );

    expect(JSON.stringify(sent)).not.toMatch(/isCorrect|misconception|reason/u);

    const answered = await readBody({
      response: await apiContext.post(`/v1/goals/${goal.id}/placement/answers`, {
        data: {
          answer: { dontKnow: true },
          durationMs: 3000,
          itemId: placement.next?.itemId,
          level: "none",
        },
      }),
      schema: placementAnswerResponseSchema,
    });

    // Once answered, coming back resumes placement instead of showing its start.
    expect(answered).toMatchObject({
      isCorrect: false,
      placement: {
        complete: true,
        dayBudgetSpent: 1 / 12,
        dayBudgetUsed: false,
        next: null,
        started: true,
        status: "done",
      },
    });

    const completion = await readBody({
      response: await apiContext.post(`/v1/goals/${goal.id}/placement/completion`, { data: {} }),
      schema: placementCompletionResponseSchema,
    });

    expect(completion.phases).toStrictEqual([
      { confident: true, phase: 0, startSkillId: skills[0]?.id },
    ]);

    await apiContext.dispose();
  });

  test("starts writing the lesson the plan opens with once a guest finishes placement", async () => {
    const { guestApi, userId } = await createGuest(baseURL);
    const [{ goal }, lesson] = await Promise.all([createGoal(userId), libraryLessonFixture()]);

    await prisma.planItem.updateMany({
      data: { lessonId: lesson.id },
      where: { plan: { goalId: goal.id }, position: 0 },
    });

    await readBody({
      response: await guestApi.post(`/v1/goals/${goal.id}/placement/completion`, {
        data: { fromScratch: true },
      }),
      schema: placementCompletionResponseSchema,
    });

    // Day 1 opens it minutes later: asked for now, it counts as its start like opening it.
    await expect
      .poll(() =>
        prisma.usageRecord.findMany({
          select: { generated: true, targetId: true },
          where: { kind: "lessonStart", userId },
        }),
      )
      .toStrictEqual([{ generated: true, targetId: lesson.id }]);

    await guestApi.dispose();
  });

  test("tests out a chapter the learner already knows", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "learner-test-out",
    });

    const { chapter, goal } = await createGoal(user.id);
    const path = `/v1/goals/${goal.id}/chapters/${chapter.id}/test-out`;

    const testOut = await readBody({
      response: await apiContext.get(path),
      schema: chapterTestOutResponseSchema,
    });

    expect(testOut.questions).toHaveLength(SKILLS);

    const result = await readBody({
      response: await apiContext.post(path, {
        data: {
          answers: testOut.questions.map((question) => ({
            answer: { selectedIndex: 0 },
            durationMs: 6000,
            itemId: question.itemId,
          })),
          requestId: randomUUID(),
        },
      }),
      schema: chapterTestOutResultSchema,
    });

    expect(result).toMatchObject({
      correct: SKILLS,
      lessonsSkipped: SKILLS,
      passed: true,
      total: SKILLS,
    });

    await apiContext.dispose();
  });

  test("writes a chapter's missing test-out questions when the learner asks, and only then", async () => {
    const [{ apiContext, user }, other] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "learner-test-out-write" }),
      createAuthenticatedApiContext({ baseURL, prefix: "learner-test-out-other" }),
    ]);

    const { chapter, goal } = await createGoal(user.id);
    const path = `/v1/goals/${goal.id}/chapters/${chapter.id}/test-out/generations`;

    // Every sampled skill has a question: nothing to write.
    await expect(
      readBody({ response: await apiContext.post(path), schema: testOutGenerationSchema }),
    ).resolves.toStrictEqual({ generationId: null, status: "ready" });

    // Without questions, asking writes them.
    const skillIds = await chapterSkillIds(goal.id);
    await prisma.item.deleteMany({ where: { skillId: { in: skillIds } } });

    const writing = await apiContext.post(path);

    const started = await readBody({
      response: writing,
      schema: testOutGenerationSchema,
      status: 202,
    });

    expect(started).toStrictEqual({ generationId: expect.any(String), status: "generating" });
    expect(writing.headers().location).toBe(`/v1/generations/${started.generationId}`);

    await expect(
      prisma.usageRecord.count({ where: { kind: "assist", userId: user.id } }),
    ).resolves.toBe(1);

    const hidden = await other.apiContext.post(path);
    expect(hidden.status()).toBe(404);

    await Promise.all([apiContext.dispose(), other.apiContext.dispose()]);
  });
});
