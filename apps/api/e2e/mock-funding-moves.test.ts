import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { formatDuration } from "@zoonk/utils/duration";
import { collidingMockMoveFixture } from "../../../packages/core/src/plans/_test-utils/colliding-mock-move";
import { unfundableMockMoveFixture } from "../../../packages/core/src/plans/_test-utils/unfundable-mock-move";
import { toIsoDate } from "../../../packages/core/src/plans/planner/plan-calendar";
import { planChangeInvalidResponse } from "../src/lib/openapi/schemas/plan-errors";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

test.afterAll(() => prisma.$disconnect());

test("refuses an unfundable full mock move with its real clock and preserves the learner's plan", async () => {
  const { api, userId } = await createBearerLearner({
    baseURL: process.env.E2E_BASE_URL ?? "",
    prefix: "funded-mock-move",
  });

  const { goal, mock, monday, plan } = await unfundableMockMoveFixture(userId);

  const readSaved = () =>
    prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { id: plan.id },
    });

  const before = await readSaved();

  const refused = await readBody({
    response: await api.post(`/v1/challenges/${mock.id}/moves`, { data: { timeZone: "UTC" } }),
    schema: planChangeInvalidResponse.content["application/json"].schema,
    status: 422,
  });

  expect(refused.error.details).toStrictEqual({
    reason: "unfundedMove",
    unfundedMove: { date: toIsoDate(monday), minutes: 330 },
  });

  expect(refused.error.message).toContain(formatDuration({ locale: "en", totalSeconds: 330 * 60 }));

  expect(refused.error.message).toContain("Pick a later day");
  await expect(readSaved()).resolves.toStrictEqual(before);

  await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toStrictEqual(
    goal,
  );

  await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);
  await api.dispose();
});

test("refuses a move onto a retained mock and keeps both events and their saved funding", async () => {
  const { api, userId } = await createBearerLearner({
    baseURL: process.env.E2E_BASE_URL ?? "",
    prefix: "mock-move-collision",
  });

  const { from, goal, plan, to } = await collidingMockMoveFixture(userId);

  const readPlan = () =>
    prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { id: plan.id },
    });

  const before = await readPlan();

  const refusal = await readBody({
    response: await api.post(`/v1/goals/${goal.id}/plan/changes`, {
      data: { operations: [{ from, kind: "moveWeeklyEvent", to }], timeZone: "UTC" },
    }),
    schema: planChangeInvalidResponse.content["application/json"].schema,
    status: 422,
  });

  expect(refusal.error.details).toStrictEqual({ reason: "mockCollision" });
  expect(refusal.error.message).toBe("That day already has a mock exam. Pick another day.");
  await expect(readPlan()).resolves.toStrictEqual(before);

  await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toStrictEqual(
    goal,
  );

  await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);
  await api.dispose();
});
