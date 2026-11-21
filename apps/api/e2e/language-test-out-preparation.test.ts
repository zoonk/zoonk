import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { createAuthenticatedApiContext } from "./helpers/auth";

test("reopens the same preparing level test-out by attempt ID", async ({ baseURL }) => {
  const { apiContext, user } = await createAuthenticatedApiContext({
    baseURL,
    prefix: "level-test-out-preparation",
  });

  const { goal, skills } = await languageGoalFixture({ userId: user.id });

  await prisma.skill.updateMany({
    data: { cefrLevel: "C1" },
    where: { id: { in: skills.map(({ id }) => id) } },
  });

  const path = `/v1/goals/${goal.id}/language-level-test/test-outs`;
  const start = await apiContext.post(path, { data: { level: "C1" } });
  expect(start.status()).toBe(200);

  const opened = await start.json();

  expect(opened).toMatchObject({
    attemptId: expect.any(String),
    level: "C1",
    next: null,
    preparing: true,
    result: null,
    total: 0,
  });

  const reopened = await apiContext.get(path, { params: { attemptId: opened.attemptId } });
  expect(await reopened.json()).toStrictEqual(opened);

  const prematureFinish = await apiContext.post(`${path}/completions`, {
    data: { attemptId: opened.attemptId },
  });

  expect(prematureFinish.status()).toBe(404);
  await apiContext.dispose();
});
