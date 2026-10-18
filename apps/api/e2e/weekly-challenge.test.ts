import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { todayResponseSchema } from "../src/lib/openapi/schemas/today";
import { weeklyChallengeResponseSchema } from "../src/lib/openapi/schemas/weekly-challenge";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("weekly challenge reads keep an unknown size and title null", async () => {
  const baseURL = process.env.E2E_BASE_URL ?? "";
  const { api, userId } = await createBearerLearner({ baseURL, prefix: "weekly-unknown" });

  try {
    const goal = await goalFixture({ timezone: "UTC", userId });
    const plan = await planFixture({ goalId: goal.id });

    const item = await planItemFixture({
      kind: "checkpoint",
      planId: plan.id,
      position: 0,
      scheduledFor: new Date("2099-01-04"),
      titleSnapshot: "",
    });

    await learningProfileFixture({ activeGoalId: goal.id, userId });
    const before = await prisma.planItem.findUniqueOrThrow({ where: { id: item.id } });

    const weekly = await readBody({
      response: await api.get(`/v1/goals/${goal.id}/weekly-challenge?timeZone=UTC`),
      schema: weeklyChallengeResponseSchema,
    });

    expect(weekly.challenge).toMatchObject({ planItemId: item.id, questions: null, title: null });

    const today = await readBody({
      response: await api.get("/v1/today?timeZone=UTC"),
      schema: todayResponseSchema,
    });

    expect(today.weeklyChallenge).toMatchObject({
      planItemId: item.id,
      questions: null,
      title: null,
    });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: item.id } }),
    ).resolves.toStrictEqual(before);

    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);
  } finally {
    await api.dispose();
  }
});
