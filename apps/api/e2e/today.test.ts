import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  goalFixture,
  planFixture,
  planItemFixture,
  suggestedGoalFixture,
} from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { memoryInsightFixture } from "@zoonk/testing/fixtures/memory";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { openedStudyDayResponseSchema } from "../src/lib/openapi/schemas/open-study-day";
import { planResponseSchema } from "../src/lib/openapi/schemas/plans";
import { suggestedGoalResultSchema } from "../src/lib/openapi/schemas/suggested-goals";
import { todayResponseSchema } from "../src/lib/openapi/schemas/today";
import { createBearerLearner } from "./helpers/bearer";

const DAY_MS = 86_400_000;
const DAYS_TO_EXAM = 20;
const SAO_PAULO = "America/Sao_Paulo";

function localDay(timeZone: string): Date {
  return getDateInTimeZone({ date: new Date(), timeZone });
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A zone whose day isn't the goal's right now: far ahead of it, or far behind it early on. */
function zoneOnAnotherDay(goalZone: string): string {
  const zones = ["Pacific/Kiritimati", "Pacific/Pago_Pago"];
  return zones.find((zone) => localDay(zone).getTime() !== localDay(goalZone).getTime()) ?? "UTC";
}

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

  const [plan] = await Promise.all([
    planFixture({ goalId: goal.id, items: [{ lessonId: lesson.id, skillId: skill.id }] }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    learningProfileFixture({ activeGoalId: goal.id, userId }),
  ]);

  return { goal, lesson, plan };
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
      api.post(`/v1/goals/${crypto.randomUUID()}/study-sessions`, {
        data: { shownDate: toIsoDay(localDay("UTC")), timeZone: "UTC" },
      }),
      api.patch(`/v1/me/suggested-goals/${crypto.randomUUID()}`, { data: { status: "accepted" } }),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([401, 401, 401]);
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
    const [{ api, userId }, stranger, course] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "today-suggested" }),
      userFixture(),
      courseFixture({ isPublished: true, title: "Physics", visibility: "public" }),
    ]);

    // The course the learner was taking still exists, so apps start it instead of onboarding.
    const [suggestion, theirs] = await Promise.all([
      suggestedGoalFixture({ courseId: course.id, title: "Physics", userId }),
      suggestedGoalFixture({ userId: stranger.id }),
    ]);

    const today = await api.get("/v1/today?timeZone=UTC");

    await expect(today.json()).resolves.toMatchObject({
      error: {
        code: "NO_ACTIVE_GOAL",
        details: {
          suggestedGoal: {
            courseId: course.id,
            id: suggestion.id,
            status: "pending",
            title: "Physics",
          },
        },
      },
    });

    const answered = await api.patch(`/v1/me/suggested-goals/${suggestion.id}`, {
      data: { status: "accepted" },
    });

    expect(answered.status(), await answered.text()).toBe(200);

    expect(suggestedGoalResultSchema.parse(await answered.json())).toStrictEqual({
      suggestedGoal: {
        courseId: course.id,
        id: suggestion.id,
        status: "accepted",
        title: "Physics",
      },
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

    expect(today.userId).toBe(userId);

    expect(today.goal).toMatchObject({ id: goal.id, kind: "exam", title: "Test exam" });

    expect(today.session.goalId).toBe(goal.id);
    expect(today.session.blocks.map((block) => block.lessonId)).toContain(lesson.id);
    expect(today.insight?.id).toBe(insight.id);
    expect(today.lessonStatus).toStrictEqual({ [lesson.id]: "notStarted" });

    const againResponse = await api.get("/v1/today?timeZone=UTC");
    const again = todayResponseSchema.parse(await againResponse.json());
    expect(today.session.status).toBe("unstarted");
    expect(again.session).toStrictEqual(today.session);
    expect(today.session).not.toHaveProperty("id");
    expect(today.session.blocks.every((block) => !("id" in block))).toBe(true);
    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);

    const openedResponse = await api.post(`/v1/goals/${goal.id}/study-sessions`, {
      data: { shownDate: today.session.localDate, timeZone: "UTC" },
    });

    expect(openedResponse.status()).toBe(201);
    const opened = openedStudyDayResponseSchema.parse(await openedResponse.json());

    expect(opened).toMatchObject({ created: true, goalId: goal.id, status: "opened" });

    const saved = await prisma.studySession.findUniqueOrThrow({
      include: { blocks: { orderBy: { position: "asc" } } },
      where: { id: opened.sessionId },
    });

    expect(opened.session.blocks.map((block) => block.id)).toStrictEqual(
      saved.blocks.map((block) => block.id),
    );

    const repeated = await api.post(`/v1/goals/${goal.id}/study-sessions`, {
      data: { shownDate: today.session.localDate, timeZone: "UTC" },
    });

    expect(repeated.status()).toBe(200);

    expect(openedStudyDayResponseSchema.parse(await repeated.json())).toMatchObject({
      created: false,
      sessionId: saved.id,
    });

    const afterResponse = await api.get("/v1/today?timeZone=UTC");
    const after = todayResponseSchema.parse(await afterResponse.json());
    expect(after.session).toStrictEqual(opened.session);

    await api.dispose();
  });

  test("shares exact saved mock funding and fractional budgets through Today and Plan", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "today-mock-funding" });
    const { goal, plan } = await createExamGoal(userId);
    const today = localDay("UTC");
    const day = toIsoDay(today);
    const mockDate = toIsoDay(new Date(today.getTime() + 10 * DAY_MS));

    const contributions = [
      { date: day, minutes: 30.125 },
      { date: toIsoDay(new Date(today.getTime() + DAY_MS)), minutes: 29.625 },
      { date: toIsoDay(new Date(today.getTime() + 7 * DAY_MS)), minutes: 30.125 },
      { date: toIsoDay(new Date(today.getTime() + 8 * DAY_MS)), minutes: 30.125 },
    ];

    const funding = [{ contributions, date: mockDate, minutes: 165 }];

    const [mock] = await Promise.all([
      planItemFixture({
        kind: "mock",
        planId: plan.id,
        position: plan.items.length + 1,
        scheduledFor: new Date(mockDate),
        titleSnapshot: "Full mock",
      }),
      prisma.goal.update({
        data: { dailyMinutes: 45, details: { placementDeclined: true } },
        where: { id: goal.id },
      }),
      prisma.plan.update({
        data: { settings: { mockFunding: funding, startDate: day } },
        where: { id: plan.id },
      }),
    ]);

    const response = await api.get(`/v1/today?goalId=${goal.id}&timeZone=UTC`);
    expect(response.status(), await response.text()).toBe(200);
    const view = todayResponseSchema.parse(await response.json());
    const expected = { mockDate, mockMinutes: 165, setAsideMinutes: 30.125 };

    expect(view.mockFunding).toStrictEqual(expected);
    expect(view.session.minutes.dailyGoal).toBe(14.875);
    expect(Number.isInteger(view.session.week.time.targetMinutes)).toBe(false);

    const planResponse = await api.get(`/v1/goals/${goal.id}/plan`);
    expect(planResponse.status(), await planResponse.text()).toBe(200);
    const planView = planResponseSchema.parse(await planResponse.json());

    expect(planView.week.days.find((entry) => entry.date === day)).toMatchObject({
      minutes: view.session.minutes.dailyGoal,
      mockFunding: expected,
    });

    expect(planView.fundedMocks).toMatchObject([
      { id: mock.id, kind: "mock", minutes: 165, scheduledFor: mockDate, status: "todo" },
    ]);

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(saved.settings).toMatchObject({ mockFunding: funding });

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

  test("reads the day in the goal's zone, and takes the request's before the learner's day starts", async () => {
    const [studied, fresh] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "today-zone-studied" }),
      createBearerLearner({ baseURL, prefix: "today-zone-fresh" }),
    ]);

    const goals = await Promise.all(
      [studied, fresh].map(async ({ userId }) => {
        const { goal } = await createExamGoal(userId);
        return prisma.goal.update({ data: { timezone: SAO_PAULO }, where: { id: goal.id } });
      }),
    );

    const device = zoneOnAnotherDay(SAO_PAULO);

    // She answered a question today in São Paulo, so her day stays the goal's until tomorrow.
    await attemptFixture({ localDate: localDay(SAO_PAULO), userId: studied.userId });

    const [kept, moved] = await Promise.all(
      [studied, fresh].map(async ({ api }) => {
        const response = await api.get(`/v1/today?timeZone=${device}`);
        expect(response.status(), await response.text()).toBe(200);
        return todayResponseSchema.parse(await response.json());
      }),
    );

    expect(kept?.session.localDate).toBe(toIsoDay(localDay(SAO_PAULO)));
    expect(moved?.session.localDate).toBe(toIsoDay(localDay(SAO_PAULO)));

    const zones = await prisma.goal.findMany({
      orderBy: { userId: "asc" },
      select: { timezone: true, userId: true },
      where: { id: { in: goals.map((goal) => goal.id) } },
    });

    expect(Object.fromEntries(zones.map((goal) => [goal.userId, goal.timezone]))).toStrictEqual({
      [fresh.userId]: SAO_PAULO,
      [studied.userId]: SAO_PAULO,
    });

    await Promise.all([studied.api.dispose(), fresh.api.dispose()]);
  });

  test("refuses a paused goal's Today", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "today-paused" });
    const { goal } = await createExamGoal(userId);

    await prisma.goal.update({
      data: { status: "paused", timezone: SAO_PAULO },
      where: { id: goal.id },
    });

    const response = await api.get(
      `/v1/today?goalId=${goal.id}&timeZone=${zoneOnAnotherDay(SAO_PAULO)}`,
    );

    expect(response.status(), await response.text()).toBe(409);
    await api.dispose();
  });

  test("rejects an invalid timezone", async () => {
    const { api } = await createBearerLearner({ baseURL, prefix: "today-invalid" });
    const response = await api.get("/v1/today?timeZone=Not/AZone");

    expect(response.status()).toBe(400);
    await api.dispose();
  });
});
