import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { skillOutlineSchema } from "@zoonk/core/lookahead/skill-outline-contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { skillOutlineGenerationSchema } from "../src/lib/openapi/schemas/skill-outlines";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { readBody } from "./helpers/response";

const ACCEPTED = 202;
const PAYMENT_REQUIRED = 402;
const DAY_MS = 86_400_000;

/** A goal whose plan has one topic of its own subject, months away, its lessons not written yet. */
async function createFarGoal({ userId }: { userId: string }) {
  const [goal, course, skill] = await Promise.all([
    goalFixture({ timezone: "UTC", title: "Learn statistics", userId }),
    courseFixture({ language: "en", title: `Statistics ${randomUUID().slice(0, 6)}` }),
    skillFixture({ level: "beginner" }),
  ]);

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "One" }],
      skills: [
        {
          area: null,
          courseIds: [course.id],
          lessons: 12,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        },
      ],
    },
  });

  await planItemFixture({
    planId: plan.id,
    position: 0,
    scheduledFor: new Date(Date.now() + 60 * DAY_MS),
    skillId: skill.id,
  });

  return { first: { course, skill }, goal };
}

function outlinePath({ goalId, skillId }: { goalId: string; skillId: string }) {
  return `/v1/goals/${goalId}/skills/${skillId}/outline`;
}

test.describe("Far topics' lesson plans API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication and hides other learners' goals", async () => {
    const anonymous = await request.newContext({ baseURL });
    const path = outlinePath({ goalId: randomUUID(), skillId: randomUUID() });

    const statuses = await Promise.all([
      anonymous.get(path),
      anonymous.post(`${path}/generations`),
    ]);

    expect(statuses.map((response) => response.status())).toStrictEqual([401, 401]);

    const { apiContext } = await createAuthenticatedApiContext({ baseURL, prefix: "outline-own" });
    const stranger = await userFixture();
    const other = await createFarGoal({ userId: stranger.id });
    const otherPath = outlinePath({ goalId: other.goal.id, skillId: other.first.skill.id });

    const hidden = await Promise.all([
      apiContext.get(otherPath),
      apiContext.post(`${otherPath}/generations`),
    ]);

    expect(hidden.map((response) => response.status())).toStrictEqual([404, 404]);
    await Promise.all([anonymous.dispose(), apiContext.dispose()]);
  });

  test("writes a far topic's lesson plan on request, counting it once", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "outline-write",
    });

    const { first, goal } = await createFarGoal({ userId: user.id });
    const path = outlinePath({ goalId: goal.id, skillId: first.skill.id });

    await expect(
      readBody({ response: await apiContext.get(path), schema: skillOutlineSchema }),
    ).resolves.toStrictEqual({ chapters: [], status: "available" });

    const started = await apiContext.post(`${path}/generations`);

    const body = await readBody({
      response: started,
      schema: skillOutlineGenerationSchema,
      status: ACCEPTED,
    });

    expect(body).toStrictEqual({ generationId: expect.any(String), status: "writing" });
    expect(started.headers().location).toBe(`/v1/generations/${body.generationId}`);

    // It reads as being written from the tap on, before its run gets to the subject.
    await expect(
      readBody({ response: await apiContext.get(path), schema: skillOutlineSchema }),
    ).resolves.toStrictEqual({ chapters: [], status: "writing" });

    // A second tap, while it's written or after its run failed, never counts again.
    const again = await apiContext.post(`${path}/generations`);
    expect(again.status()).toBe(ACCEPTED);

    await expect(
      prisma.usageRecord.findMany({
        select: { kind: true, targetId: true },
        where: { userId: user.id },
      }),
    ).resolves.toStrictEqual([{ kind: "outline", targetId: first.skill.id }]);

    await apiContext.dispose();
  });

  test("refuses a free learner's fourth topic of the day", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "outline-limit",
    });

    // Three topics written today, each counted once as a request counts it (see above).
    const [{ first, goal }] = await Promise.all([
      createFarGoal({ userId: user.id }),
      usageRecordsFixture({ count: 3, kind: "outline", userId: user.id }),
    ]);

    const response = await apiContext.post(
      `${outlinePath({ goalId: goal.id, skillId: first.skill.id })}/generations`,
    );

    expect(response.status()).toBe(PAYMENT_REQUIRED);

    await apiContext.dispose();
  });
});
