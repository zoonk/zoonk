import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import {
  goalFixture,
  planFixture,
  planItemFixture,
  suggestedGoalFixture,
} from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { memoryInsightFixture } from "@zoonk/testing/fixtures/memory";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { suggestedGoalResultSchema } from "../src/lib/openapi/schemas/suggested-goals";
import { todayResponseSchema } from "../src/lib/openapi/schemas/today";
import { createBearerLearner } from "./helpers/bearer";

const DAY_MS = 86_400_000;
const DAYS_TO_EXAM = 20;

/** An exam goal 20 days away with one lesson in its plan, set as the learner's active goal. */
async function createExamGoal(userId: string) {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);

  const [goal, skill, lesson] = await Promise.all([
    goalFixture({
      dailyMinutes: 20,
      kind: "exam",
      targetDate: new Date(today.getTime() + DAYS_TO_EXAM * DAY_MS),
      timezone: "UTC",
      title: "Test exam",
      userId,
    }),
    skillFixture({ name: "Percentages" }),
    libraryLessonFixture({ canDo: "You'll work out a discount", title: "Discounts" }),
  ]);

  const plan = await planFixture({ goalId: goal.id });

  await Promise.all([
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    planItemFixture({ kind: "lesson", lessonId: lesson.id, planId: plan.id, position: 0 }),
    learningProfileFixture({ activeGoalId: goal.id, userId }),
  ]);

  return { goal, lesson };
}

test.describe("Today API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication", async () => {
    const api = await request.newContext({ baseURL });

    const responses = await Promise.all([
      api.get("/v1/today"),
      api.patch(`/v1/me/suggested-goals/${crypto.randomUUID()}`, { data: { status: "accepted" } }),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([401, 401]);
    await api.dispose();
  });

  test("asks a learner without a goal to start one", async () => {
    const { api } = await createBearerLearner({ baseURL, prefix: "today-no-goal" });
    const response = await api.get("/v1/today?timeZone=UTC");

    expect(response.status()).toBe(404);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "NO_ACTIVE_GOAL", details: { suggestedGoal: null } },
    });

    await api.dispose();
  });

  test("offers a returning learner's last course, answered once", async () => {
    const [{ api, userId }, stranger] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "today-suggested" }),
      userFixture(),
    ]);

    const [suggestion, theirs] = await Promise.all([
      suggestedGoalFixture({ title: "Physics", userId }),
      suggestedGoalFixture({ userId: stranger.id }),
    ]);

    const today = await api.get("/v1/today?timeZone=UTC");

    await expect(today.json()).resolves.toMatchObject({
      error: {
        code: "NO_ACTIVE_GOAL",
        details: { suggestedGoal: { id: suggestion.id, status: "pending", title: "Physics" } },
      },
    });

    const answered = await api.patch(`/v1/me/suggested-goals/${suggestion.id}`, {
      data: { status: "accepted" },
    });

    expect(answered.status(), await answered.text()).toBe(200);

    expect(suggestedGoalResultSchema.parse(await answered.json())).toStrictEqual({
      suggestedGoal: { id: suggestion.id, status: "accepted", title: "Physics" },
    });

    const [again, others] = await Promise.all([
      api.patch(`/v1/me/suggested-goals/${suggestion.id}`, { data: { status: "dismissed" } }),
      api.patch(`/v1/me/suggested-goals/${theirs.id}`, { data: { status: "dismissed" } }),
    ]);

    expect([again.status(), others.status()]).toStrictEqual([409, 404]);

    await expect(again.json()).resolves.toMatchObject({
      error: { code: "SUGGESTED_GOAL_ALREADY_ANSWERED" },
    });

    const after = await api.get("/v1/today?timeZone=UTC");

    await expect(after.json()).resolves.toMatchObject({
      error: { details: { suggestedGoal: null } },
    });

    await api.dispose();
  });

  test("returns the active goal's Today with its session and insight", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "today" });
    const { goal, lesson } = await createExamGoal(userId);

    // Insights come from memory, which a learner without an adult's age answer turns on.
    const [insight] = await Promise.all([
      memoryInsightFixture({ goalId: goal.id, userId }),
      learningProfileFixture({ memoryEnabled: true, userId }),
    ]);

    const response = await api.get("/v1/today?timeZone=UTC");
    expect(response.status(), await response.text()).toBe(200);

    const today = todayResponseSchema.parse(await response.json());

    expect(today.goal).toMatchObject({
      daysLeft: DAYS_TO_EXAM,
      id: goal.id,
      kind: "exam",
      title: "Test exam",
    });

    expect(today.session.goalId).toBe(goal.id);
    expect(today.session.blocks.map((block) => block.lessonId)).toContain(lesson.id);
    expect(today.insight?.id).toBe(insight.id);
    expect(today.lessonStatus).toStrictEqual({ [lesson.id]: "notStarted" });
    expect(today.suggestedGoal).toBeNull();

    const againResponse = await api.get("/v1/today?timeZone=UTC");
    const again = todayResponseSchema.parse(await againResponse.json());
    expect(again.session.id).toBe(today.session.id);

    await api.dispose();
  });

  test("says the plan is still being built instead of an empty day", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "today-preparing" });
    const goal = await goalFixture({ timezone: "UTC", title: "Quantum physics", userId });

    await Promise.all([
      planFixture({ goalId: goal.id }),
      learningProfileFixture({ activeGoalId: goal.id, userId }),
    ]);

    const response = await api.get("/v1/today?timeZone=UTC");

    expect(response.status()).toBe(409);

    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "PLAN_NOT_READY",
        details: { goal: { id: goal.id, title: "Quantum physics" } },
      },
    });

    await api.dispose();
  });

  test("rejects an invalid timezone", async () => {
    const { api } = await createBearerLearner({ baseURL, prefix: "today-invalid" });
    const response = await api.get("/v1/today?timeZone=Not/AZone");

    expect(response.status()).toBe(400);
    await api.dispose();
  });
});
