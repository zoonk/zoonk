import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  focusTestGenerationSchema,
  focusTestResponseSchema,
  focusTestResultSchema,
} from "../src/lib/openapi/schemas/focus-test";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { readBody } from "./helpers/response";

const AREAS = ["Algebra", "Geometry"] as const;
const SKILLS_PER_AREA = 4;

/** A goal whose plan has two areas of four skills, each skill with one multiple-choice question. */
async function createGoal(userId: string) {
  const suffix = randomUUID().slice(0, 6);
  const goal = await goalFixture({ userId });

  const skills = await Promise.all(
    AREAS.flatMap((area) =>
      Array.from({ length: SKILLS_PER_AREA }, async (_, index) => ({
        area,
        skill: await skillFixture({ name: `${area} skill ${index + 1} ${suffix}` }),
      })),
    ),
  );

  await Promise.all([
    planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Basics" }],
        skills: skills.map(({ area, skill }) => ({
          area,
          lessons: 2,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        })),
      },
    }),
    ...skills.map(({ skill }) => itemFixture({ content: choiceItemContent(), skillId: skill.id })),
  ]);

  return { goal, skills };
}

test.describe("Focus test API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication", async () => {
    const apiContext = await request.newContext({ baseURL });
    const path = `/v1/goals/${randomUUID()}/plan/focus-test`;

    const responses = await Promise.all([
      apiContext.get(path),
      apiContext.post(path, {
        data: {
          answers: [{ answer: { selectedIndex: 0 }, durationMs: 1000, itemId: randomUUID() }],
        },
      }),
      apiContext.post(`${path}/generations`),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([401, 401, 401]);
    await apiContext.dispose();
  });

  test("asks about each area and focuses the plan where the answers show it's needed", async () => {
    const [{ apiContext, user }, other] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "focus-test" }),
      createAuthenticatedApiContext({ baseURL, prefix: "focus-test-other" }),
    ]);

    const { goal } = await createGoal(user.id);
    const path = `/v1/goals/${goal.id}/plan/focus-test`;

    const focusTest = await readBody({
      response: await apiContext.get(path),
      schema: focusTestResponseSchema,
    });

    expect(focusTest).toMatchObject({ areas: [...AREAS], needsItems: [], questionsPerArea: 4 });

    expect(focusTest.questions.map((question) => question.area)).toStrictEqual(
      AREAS.flatMap((area) => Array.from({ length: SKILLS_PER_AREA }, () => area)),
    );

    // Someone else's goal stays hidden.
    const hidden = await other.apiContext.get(path);
    expect(hidden.status()).toBe(404);

    const result = await readBody({
      response: await apiContext.post(path, {
        data: {
          answers: focusTest.questions.map((question) => ({
            answer: question.area === "Algebra" ? { selectedIndex: 0 } : { dontKnow: true },
            durationMs: 7000,
            itemId: question.itemId,
          })),
        },
      }),
      schema: focusTestResultSchema,
    });

    expect(result).toMatchObject({
      areas: [
        { chosen: false, correct: 4, name: "Algebra", total: 4 },
        { chosen: true, correct: 0, name: "Geometry", total: 4 },
      ],
      focusAreas: ["Geometry"],
    });

    // A question once answered is never asked again: taking the test again needs new ones.
    const again = await readBody({
      response: await apiContext.get(path),
      schema: focusTestResponseSchema,
    });

    expect(again.questions).toStrictEqual([]);
    expect(again.needsItems).toHaveLength(AREAS.length * SKILLS_PER_AREA);

    await Promise.all([apiContext.dispose(), other.apiContext.dispose()]);
  });

  test("writes the missing questions when the learner starts the test, and only then", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "focus-test-write",
    });

    const { goal, skills } = await createGoal(user.id);
    const path = `/v1/goals/${goal.id}/plan/focus-test/generations`;

    // Every area has its questions: nothing to write.
    await expect(
      readBody({ response: await apiContext.post(path), schema: focusTestGenerationSchema }),
    ).resolves.toStrictEqual({ generationId: null, status: "ready" });

    const geometry = skills.filter(({ area }) => area === "Geometry").map(({ skill }) => skill.id);
    await prisma.item.deleteMany({ where: { skillId: { in: geometry } } });

    // Algebra's questions are asked while geometry's are written.
    const partial = await readBody({
      response: await apiContext.get(`/v1/goals/${goal.id}/plan/focus-test`),
      schema: focusTestResponseSchema,
    });

    expect(partial.needsItems.toSorted()).toStrictEqual(geometry.toSorted());

    expect(partial.questions.map((question) => question.area)).toStrictEqual(
      Array.from({ length: SKILLS_PER_AREA }, () => "Algebra"),
    );

    const writing = await apiContext.post(path);

    const started = await readBody({
      response: writing,
      schema: focusTestGenerationSchema,
      status: 202,
    });

    expect(started).toStrictEqual({ generationId: expect.any(String), status: "generating" });
    expect(writing.headers().location).toBe(`/v1/generations/${started.generationId}`);

    await expect(
      prisma.usageRecord.count({ where: { kind: "assist", userId: user.id } }),
    ).resolves.toBe(1);

    await apiContext.dispose();
  });

  test("a plan of one area has no focus to choose", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "focus-test-one-area",
    });

    const goal = await goalFixture({ userId: user.id });
    const skill = await skillFixture({ name: `Only skill ${randomUUID().slice(0, 6)}` });

    await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Basics" }],
        skills: [
          {
            area: "Algebra",
            lessons: 2,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: null,
          },
        ],
      },
    });

    const unavailable = await apiContext.get(`/v1/goals/${goal.id}/plan/focus-test`);
    expect(unavailable.status()).toBe(404);
    await apiContext.dispose();
  });
});
