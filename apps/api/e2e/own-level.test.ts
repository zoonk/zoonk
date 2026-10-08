import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { ownLevelChangeSchema } from "../src/lib/openapi/schemas/plans";
import { createAuthenticatedApiContext } from "./helpers/auth";

/** A goal whose plan has two chapters of two skills each, learned by someone who said "basic". */
async function createGoal(userId: string) {
  const [goal, chapters, skills] = await Promise.all([
    goalFixture({ details: { level: "basic" }, title: "Percentages", userId }),
    Promise.all([1, 2].map((index) => libraryChapterFixture({ title: `Chapter ${index}` }))),
    Promise.all([1, 2, 3, 4].map((index) => skillFixture({ name: `Skill ${index}` }))),
  ]);

  const plan = await planFixture({ goalId: goal.id });

  await Promise.all(
    skills.map((skill, position) =>
      planItemFixture({
        chapterId: chapters[Math.floor(position / 2)]?.id ?? null,
        phase: 0,
        planId: plan.id,
        position,
        skillId: skill.id,
      }),
    ),
  );

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
      anonymous.put(`/v1/goals/${goal.id}/plan/own-level`, { data: { level: "basic" } }),
      apiContext.put(`/v1/goals/${goal.id}/plan/own-level`, { data: { level: "basic" } }),
      apiContext.put(`/v1/goals/${randomUUID()}/plan/own-level`, { data: { level: "basic" } }),
      apiContext.put(`/v1/goals/${goal.id}/plan/own-level`, { data: { level: "expert" } }),
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

    const raise = await apiContext.put(`/v1/goals/${goal.id}/plan/own-level`, {
      data: { level: "advanced", timeZone: "UTC" },
    });

    const raised = ownLevelChangeSchema.parse(await raise.json());

    expect(raised).toStrictEqual({
      change: null,
      direction: "higher",
      level: "advanced",
      testOuts: chapters.map((chapter) => ({ chapterId: chapter.id, title: chapter.title })),
    });

    const lowered = await apiContext.put(`/v1/goals/${goal.id}/plan/own-level`, {
      data: { level: "none" },
    });

    expect(lowered.status()).toBe(200);

    expect(ownLevelChangeSchema.parse(await lowered.json())).toMatchObject({
      direction: "lower",
      level: "none",
      testOuts: [],
    });

    const [stored, items] = await Promise.all([
      prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      prisma.planItem.findMany({ where: { plan: { goalId: goal.id } } }),
    ]);

    expect(stored.details).toMatchObject({ level: "none" });
    expect(items.every((item) => item.status === "todo")).toBe(true);

    await apiContext.dispose();
  });
});
