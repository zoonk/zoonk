import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { ownLevelChangeSchema } from "../src/lib/openapi/schemas/plans";
import { createAuthenticatedApiContext } from "./helpers/auth";

async function createGoal(userId: string) {
  const [goal, chapters, skills] = await Promise.all([
    goalFixture({ details: { level: "basic" }, title: "Percentages", userId }),
    Promise.all([1, 2].map((index) => libraryChapterFixture({ title: `Chapter ${index}` }))),
    Promise.all([1, 2, 3, 4].map((index) => skillFixture({ name: `Skill ${index}` }))),
  ]);

  await planFixture({
    goalId: goal.id,
    items: skills.map((skill, position) => ({
      chapterId: chapters[Math.floor(position / 2)]?.id ?? null,
      skillId: skill.id,
    })),
  });

  return { chapters, goal };
}

test.describe("Own level API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test("needs a session and the learner's own goal", async () => {
    const [anonymous, { apiContext }, owner] = await Promise.all([
      request.newContext({ baseURL }),
      createAuthenticatedApiContext({ baseURL, prefix: "own-level-other" }),
      userFixture(),
    ]);

    const { goal } = await createGoal(owner.id);

    const [unauthorized, hidden, missing, invalid] = await Promise.all([
      anonymous.post(`/v1/goals/${goal.id}/plan/own-level`, { data: { level: "basic" } }),
      apiContext.post(`/v1/goals/${goal.id}/plan/own-level`, { data: { level: "basic" } }),
      apiContext.post(`/v1/goals/${randomUUID()}/plan/own-level`, { data: { level: "basic" } }),
      apiContext.post(`/v1/goals/${goal.id}/plan/own-level`, { data: { level: "expert" } }),
    ]);

    expect(
      [unauthorized, hidden, missing, invalid].map((response) => response.status()),
    ).toStrictEqual([401, 404, 404, 400]);

    await Promise.all([anonymous.dispose(), apiContext.dispose()]);
  });

  test("raising offers test-outs and skips nothing; lowering keeps past work", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "own-level",
    });

    const { chapters, goal } = await createGoal(user.id);

    const [read, oldMutation] = await Promise.all([
      apiContext.get(`/v1/goals/${goal.id}/plan/own-level`),
      apiContext.put(`/v1/goals/${goal.id}/plan/own-level`, { data: { level: "advanced" } }),
    ]);

    expect([read.status(), oldMutation.status()]).toStrictEqual([405, 405]);

    const untouched = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(untouched.details).toMatchObject({ level: "basic" });

    const raise = await apiContext.post(`/v1/goals/${goal.id}/plan/own-level`, {
      data: { level: "advanced", timeZone: "UTC" },
    });

    const raised = ownLevelChangeSchema.parse(await raise.json());

    expect(raised).toStrictEqual({
      change: null,
      direction: "higher",
      level: "advanced",
      testOuts: chapters.map((chapter) => ({ chapterId: chapter.id, title: chapter.title })),
    });

    const lowered = await apiContext.post(`/v1/goals/${goal.id}/plan/own-level`, {
      data: { level: "none" },
    });

    expect(lowered.status()).toBe(200);

    expect(ownLevelChangeSchema.parse(await lowered.json())).toMatchObject({
      direction: "lower",
      level: "none",
      testOuts: [],
    });

    await apiContext.dispose();
  });
});
