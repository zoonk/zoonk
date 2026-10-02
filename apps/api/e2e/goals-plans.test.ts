import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import {
  goalCreateResponseSchema,
  goalListResponseSchema,
  goalSchema,
  goalUpdateResponseSchema,
} from "../src/lib/openapi/schemas/goals";
import {
  planChangeResultSchema,
  planChangeSchema,
  planLinkResponseSchema,
  planResponseSchema,
} from "../src/lib/openapi/schemas/plans";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { createGuest } from "./helpers/bearer";
import { readBody } from "./helpers/response";

const LESSONS = 12;

/** A guest's small AI help for a day (`assist` in core's limits). */
const GUEST_DAILY_HELP = 40;

/**
 * A goal whose plan has its skill graph (what the goal-driven workflow writes) and a Library chapter
 * with twelve 3-minute lessons for its one skill, for a public course.
 */
async function createPlannedGoal(userId: string) {
  const [course, chapter, skill] = await Promise.all([
    courseFixture({
      description: "Prices, shares and risk",
      title: `Stock market ${randomUUID()}`,
    }),
    libraryChapterFixture({ title: "How prices move" }),
    skillFixture({ name: "Read a stock quote" }),
  ]);

  const lessons = await Promise.all(
    Array.from({ length: LESSONS }, (_, index) =>
      libraryLessonFixture({
        estimatedMinutes: 3,
        homeChapterId: chapter.id,
        title: `Lesson ${index + 1}`,
      }),
    ),
  );

  await Promise.all(
    lessons.flatMap((lesson, position) => [
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    ]),
  );

  const goal = await goalFixture({ dailyMinutes: 12, primaryCourseId: course.id, userId });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: "Read the market's news", name: "The basics" }],
      skills: [
        {
          area: "Markets",
          lessons: LESSONS,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        },
      ],
    },
    phases: [
      { kind: "learn", milestone: "Read the market's news", minutes: 0, name: "The basics" },
    ],
  });

  return { chapter, course, goal, plan, skill };
}

test.describe("Goals and plans API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication for goals and plans", async () => {
    const apiContext = await request.newContext({ baseURL });
    const goalId = randomUUID();

    const responses = await Promise.all([
      apiContext.get("/v1/goals"),
      apiContext.post("/v1/goals", {
        data: {
          dailyMinutes: 20,
          goals: [{ kind: "learn", language: "en", prompt: "AI", title: "AI" }],
        },
      }),
      apiContext.get(`/v1/goals/${goalId}`),
      apiContext.patch(`/v1/goals/${goalId}`, { data: { title: "x" } }),
      apiContext.get(`/v1/goals/${goalId}/plan`),
      apiContext.post(`/v1/goals/${goalId}/plan/changes`, {
        data: { operations: [{ kind: "setDailyMinutes", minutes: 20 }] },
      }),
      apiContext.patch(`/v1/goals/${goalId}/plan/changes/${randomUUID()}`, {
        data: { status: "undone" },
      }),
      apiContext.post(`/v1/goals/${goalId}/plan/edit-requests`, {
        data: { text: "less on weekends" },
      }),
      apiContext.post(`/v1/plan-links/${randomUUID()}/goals`, { data: { dailyMinutes: 20 } }),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual(responses.map(() => 401));
    await apiContext.dispose();
  });

  test("creates goals that share the day's time and lists them with the main goal first", async () => {
    const { apiContext } = await createAuthenticatedApiContext({ baseURL, prefix: "goals-create" });

    const created = await readBody({
      response: await apiContext.post("/v1/goals", {
        data: {
          dailyMinutes: 30,
          goals: [
            {
              kind: "language",
              language: "pt",
              prompt: "Inglês",
              targetLanguage: "en",
              title: "English",
            },
          ],
          studyDays: [1, 2, 3, 4, 5],
          timeZone: "America/Sao_Paulo",
        },
      }),
      schema: goalCreateResponseSchema,
      status: 201,
    });

    expect(created).toMatchObject({
      goals: [{ dailyMinutes: 30, isActive: true, kind: "language", studyDays: [1, 2, 3, 4, 5] }],
      refused: [],
      research: [],
    });

    const second = await apiContext.post("/v1/goals", {
      data: {
        dailyMinutes: 30,
        // A quick explanation has its own allowance, so the second goal to plan is refused.
        goals: [{ kind: "learn", language: "pt", prompt: "Astronomia", title: "Astronomia" }],
      },
    });

    expect(second.status()).toBe(429);
    await expect(second.json()).resolves.toMatchObject({ error: { code: "GOAL_LIMIT_REACHED" } });

    const list = await readBody({
      response: await apiContext.get("/v1/goals"),
      schema: goalListResponseSchema,
    });

    expect(list).toMatchObject({ activeGoalId: created.goals[0]?.id, dailyMinutes: 30 });

    const invalid = await apiContext.post("/v1/goals", { data: { dailyMinutes: 1, goals: [] } });
    expect(invalid.status()).toBe(400);
    await apiContext.dispose();
  });

  test("reads and edits a plan, and undoes the change", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "plans-edit",
    });

    const { goal } = await createPlannedGoal(user.id);

    const before = await readBody({
      response: await apiContext.get(`/v1/goals/${goal.id}/plan`),
      schema: planResponseSchema,
    });

    expect(before).toMatchObject({ ready: true, schedule: { dailyMinutes: 12 } });
    expect(before.feasibility?.fits).toBe(true);

    const changed = await readBody({
      response: await apiContext.post(`/v1/goals/${goal.id}/plan/changes`, {
        data: { operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [0, 6] }] },
      }),
      schema: planChangeResultSchema,
    });

    expect(changed).toMatchObject({
      change: { canUndo: true, kind: "edited", status: "applied" },
      status: "applied",
    });

    const after = await readBody({
      response: await apiContext.get(`/v1/goals/${goal.id}/plan`),
      schema: planResponseSchema,
    });

    expect(after.schedule).toMatchObject({
      studyDays: 5,
      weekdayMinutes: [0, 12, 12, 12, 12, 12, 0],
    });

    expect(after.phases[0]?.lessonsTotal).toBe(LESSONS);
    expect(after.changes[0]?.id).toBe(changed.change?.id);

    const undone = await readBody({
      response: await apiContext.patch(`/v1/goals/${goal.id}/plan/changes/${changed.change?.id}`, {
        data: { status: "undone" },
      }),
      schema: planChangeSchema,
    });

    expect(undone).toMatchObject({ canUndo: false, status: "undone" });

    const again = await apiContext.patch(
      `/v1/goals/${goal.id}/plan/changes/${changed.change?.id}`,
      { data: { status: "undone" } },
    );

    expect(again.status()).toBe(409);

    const unknownArea = await apiContext.post(`/v1/goals/${goal.id}/plan/changes`, {
      data: { operations: [{ areas: ["History"], kind: "focusAreas" }] },
    });

    expect(unknownArea.status()).toBe(422);

    await expect(unknownArea.json()).resolves.toMatchObject({
      error: { code: "PLAN_CHANGE_INVALID", details: { reason: "unknownArea" } },
    });

    const empty = await apiContext.post(`/v1/goals/${goal.id}/plan/edit-requests`, {
      data: { text: "" },
    });

    expect(empty.status()).toBe(400);
    await apiContext.dispose();
  });

  test("updates a goal's time, which re-plans, and hides other learners' goals", async () => {
    const [{ apiContext, user }, stranger] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "goals-update" }),
      userFixture(),
    ]);

    const [{ goal }, other] = await Promise.all([
      createPlannedGoal(user.id),
      createPlannedGoal(stranger.id),
    ]);

    const updated = await readBody({
      response: await apiContext.patch(`/v1/goals/${goal.id}`, {
        data: { dailyMinutes: 30, title: "Markets" },
      }),
      schema: goalUpdateResponseSchema,
    });

    expect(updated).toMatchObject({
      change: { kind: "edited" },
      goal: { dailyMinutes: 30, title: "Markets" },
    });

    const [read, hidden, hiddenPlan, pastDate] = await Promise.all([
      apiContext.get(`/v1/goals/${goal.id}`),
      apiContext.get(`/v1/goals/${other.goal.id}`),
      apiContext.get(`/v1/goals/${other.goal.id}/plan`),
      apiContext.patch(`/v1/goals/${goal.id}`, { data: { targetDate: "2020-01-01" } }),
    ]);

    await expect(readBody({ response: read, schema: goalSchema })).resolves.toMatchObject({
      title: "Markets",
    });

    expect(hidden.status()).toBe(404);
    expect(hiddenPlan.status()).toBe(404);
    expect(pastDate.status()).toBe(422);
    await apiContext.dispose();
  });

  test("asks a guest who used today's help to sign up before reading plain words", async () => {
    const guest = await createGuest(baseURL);

    const [{ goal }] = await Promise.all([
      createPlannedGoal(guest.userId),
      usageRecordsFixture({
        count: GUEST_DAILY_HELP,
        createdAt: new Date(),
        kind: "assist",
        userId: guest.userId,
      }),
    ]);

    const response = await guest.guestApi.post(`/v1/goals/${goal.id}/plan/edit-requests`, {
      data: { text: "less on weekends" },
    });

    expect(response.status()).toBe(403);

    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "USAGE_LIMIT_REACHED",
        details: { limit: { period: "day", resource: "assist", tier: "guest" } },
      },
    });

    await guest.guestApi.dispose();
  });

  test("shares a plan's outline through its link and starts a visitor's own goal from it", async () => {
    const [owner, { apiContext: visitor, user }] = await Promise.all([
      userFixture(),
      createAuthenticatedApiContext({ baseURL, prefix: "plan-link" }),
    ]);

    const { course, goal, plan } = await createPlannedGoal(owner.id);
    const anonymous = await request.newContext({ baseURL });

    const outline = await readBody({
      response: await anonymous.get(`/v1/plan-links/${plan.id}`),
      schema: planLinkResponseSchema,
    });

    expect(outline).toMatchObject({
      outline: {
        phases: [{ name: "The basics" }],
        skillCount: 1,
        subject: { title: course.title },
      },
      owner: null,
    });

    expect(JSON.stringify(outline)).not.toContain(goal.id);

    const started = await readBody({
      response: await visitor.post(`/v1/plan-links/${plan.id}/goals`, {
        data: { dailyMinutes: 20 },
      }),
      schema: goalSchema,
      status: 201,
    });

    expect(started).toMatchObject({
      dailyMinutes: 20,
      isActive: true,
      primaryCourseId: course.id,
      title: course.title,
    });

    const copy = await prisma.plan.findUniqueOrThrow({
      include: { items: true },
      where: { goalId: started.id },
    });

    expect(copy.items.filter((item) => item.kind === "lesson")).toHaveLength(LESSONS);

    await expect(prisma.goal.count({ where: { id: started.id, userId: user.id } })).resolves.toBe(
      1,
    );

    const missing = await anonymous.get(`/v1/plan-links/${randomUUID()}`);
    expect(missing.status()).toBe(404);

    await Promise.all([anonymous.dispose(), visitor.dispose()]);
  });
});
