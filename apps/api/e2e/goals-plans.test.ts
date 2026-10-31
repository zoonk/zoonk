import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { planChangeSchema } from "@zoonk/core/plans/change-contract";
import { planChangedSinceSchema } from "@zoonk/core/plans/changed-since-contract";
import {
  planTimeAdviceSchema,
  planTimeToCoverSchema,
} from "@zoonk/core/plans/time-advice-contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { z } from "zod";
import {
  goalCreateResponseSchema,
  goalListResponseSchema,
  goalSchema,
  goalUpdateResponseSchema,
} from "../src/lib/openapi/schemas/goals";
import {
  planChangeResultSchema,
  planLinkResponseSchema,
  planResponseSchema,
} from "../src/lib/openapi/schemas/plans";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { readBody } from "./helpers/response";

const LESSONS = 12;
const LESSONS_PER_DAY = 4;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** A fixed layout, not the planner's own: reads keep a layout the learner saw while its inputs stay the same. */
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
  const today = Math.floor(Date.now() / DAY_MS) * DAY_MS;
  const lastDay = new Date(today + (LESSONS / LESSONS_PER_DAY - 1) * DAY_MS);

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
      {
        endDate: lastDay.toISOString().slice(0, 10),
        kind: "learn",
        milestone: "Read the market's news",
        minutes: 0,
        name: "The basics",
        startDate: new Date(today).toISOString().slice(0, 10),
      },
    ],
  });

  await Promise.all([
    ...lessons.map((lesson, position) =>
      planItemFixture({
        lessonId: lesson.id,
        planId: plan.id,
        position,
        scheduledFor: new Date(today + Math.floor(position / LESSONS_PER_DAY) * DAY_MS),
        skillId: skill.id,
        titleSnapshot: lesson.title,
      }),
    ),
    planItemFixture({
      kind: "boss",
      planId: plan.id,
      position: LESSONS,
      scheduledFor: lastDay,
      titleSnapshot: "The basics",
    }),
  ]);

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
      apiContext.post(`/v1/goals/${goalId}/plan/time-advice`, { data: {} }),
      apiContext.get(`/v1/goals/${goalId}/plan/resume-preview`),
      apiContext.get(`/v1/goals/${goalId}/plan/changed-since?since=${new Date().toISOString()}`),
      apiContext.post(`/v1/goals/${goalId}/plan/changes`, {
        data: { operations: [{ kind: "setDailyMinutes", minutes: 20 }] },
      }),
      apiContext.post(`/v1/goals/${goalId}/plan/changes/${randomUUID()}`, {
        data: { status: "undone" },
      }),
      apiContext.post(`/v1/plan-links/${randomUUID()}/goals`, { data: { dailyMinutes: 20 } }),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual(responses.map(() => 401));
    await apiContext.dispose();
  });

  test("refuses weekly moves before next Monday through changes and previews", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "move-date",
    });

    const { goal, plan } = await createPlannedGoal(user.id);
    const day = new Date().toISOString().slice(0, 10);
    const data = { operations: [{ from: day, kind: "moveWeeklyEvent", to: day }], timeZone: "UTC" };
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    await Promise.all(
      ["changes", "change-previews"].map(async (endpoint) => {
        const response = await apiContext.post(`/v1/goals/${goal.id}/plan/${endpoint}`, { data });
        expect(response.status()).toBe(422);

        expect(await response.json()).toMatchObject({
          error: {
            code: "PLAN_CHANGE_INVALID",
            details: { reason: "moveBeforeNextMonday" },
            message: "Pick a day on or after next Monday to move a weekly challenge or mock exam.",
          },
        });
      }),
    );

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toStrictEqual(
      before,
    );

    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);
    await apiContext.dispose();
  });

  test("refuses a newly supplied past date without creating a goal or plan", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "past-new-goal",
    });

    const targetDate = new Date().toISOString().slice(0, 10);

    const response = await apiContext.post("/v1/goals", {
      data: {
        dailyMinutes: 15,
        goals: [{ kind: "learn", language: "en", prompt: "Algebra", targetDate, title: "Algebra" }],
        timeZone: "UTC",
      },
    });

    expect(response.status()).toBe(422);

    expect(await response.json()).toMatchObject({
      error: {
        code: "TARGET_DATE_OUT_OF_RANGE",
        details: [{ bound: "earliest", path: ["goals", 0, "targetDate"] }],
      },
    });

    await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.plan.count({ where: { goal: { userId: user.id } } })).resolves.toBe(0);
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

    expect(before).toMatchObject({
      ready: true,
      schedule: { dailyMinutes: 12 },
      weekTime: { studiedMinutes: 0 },
    });

    expect(before.feasibility).toBeNull();

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

    expect(after.feasibility?.fits).toBe(true);

    expect(after.changes[0]).toMatchObject({ id: changed.change?.id, seen: false });

    const savedChange = await prisma.planChange.findUniqueOrThrow({
      where: { id: changed.change?.id },
    });

    const [readDecision, oldDecision] = await Promise.all([
      apiContext.get(`/v1/goals/${goal.id}/plan/changes/${changed.change?.id}`),
      apiContext.patch(`/v1/goals/${goal.id}/plan/changes/${changed.change?.id}`, {
        data: { status: "undone" },
      }),
    ]);

    expect([readDecision.status(), oldDecision.status()]).toStrictEqual([405, 405]);

    const untouched = await prisma.planChange.findUniqueOrThrow({
      where: { id: changed.change?.id },
    });

    expect(untouched).toStrictEqual(savedChange);

    const seen = await readBody({
      response: await apiContext.post(`/v1/goals/${goal.id}/plan/changes/${changed.change?.id}`, {
        data: { status: "seen" },
      }),
      schema: planChangeSchema,
    });

    expect(seen).toMatchObject({ canUndo: true, seen: true, status: "applied" });

    const undone = await readBody({
      response: await apiContext.post(`/v1/goals/${goal.id}/plan/changes/${changed.change?.id}`, {
        data: { status: "undone" },
      }),
      schema: planChangeSchema,
    });

    expect(undone).toMatchObject({ canUndo: false, status: "undone" });

    const again = await apiContext.post(`/v1/goals/${goal.id}/plan/changes/${changed.change?.id}`, {
      data: { status: "undone" },
    });

    expect(again.status()).toBe(409);

    const seenAfterUndo = await apiContext.post(
      `/v1/goals/${goal.id}/plan/changes/${changed.change?.id}`,
      { data: { status: "seen" } },
    );

    expect(seenAfterUndo.status()).toBe(409);

    const unknownArea = await apiContext.post(`/v1/goals/${goal.id}/plan/changes`, {
      data: { operations: [{ areas: ["History"], kind: "focusAreas" }] },
    });

    expect(unknownArea.status()).toBe(422);

    await expect(unknownArea.json()).resolves.toMatchObject({
      error: { code: "PLAN_CHANGE_INVALID", details: { reason: "unknownArea" } },
    });

    await apiContext.dispose();
  });

  test("says what a daily time covers, and finds the time that covers the goal only when asked", async () => {
    const [{ apiContext, user }, stranger] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "plans-time-advice" }),
      userFixture(),
    ]);

    const [{ goal }, other] = await Promise.all([
      createPlannedGoal(user.id),
      createPlannedGoal(stranger.id),
    ]);

    const targetDate = new Date(Date.now() + 2 * DAY_MS).toISOString().slice(0, 10);

    await prisma.goal.update({
      data: { targetDate: new Date(`${targetDate}T00:00:00Z`) },
      where: { id: goal.id },
    });

    const [everyDay, weekdays, weekend, plan, invalid, tooLong, hidden, everything, badEverything] =
      await Promise.all([
        apiContext.post(`/v1/goals/${goal.id}/plan/time-advice`, { data: {} }),
        apiContext.post(`/v1/goals/${goal.id}/plan/time-advice`, {
          data: { studyDays: [1, 2, 3, 4, 5] },
        }),
        apiContext.post(`/v1/goals/${goal.id}/plan/time-advice`, { data: { weekendMinutes: 120 } }),
        apiContext.get(`/v1/goals/${goal.id}/plan`),
        apiContext.post(`/v1/goals/${goal.id}/plan/time-advice`, { data: { studyDays: [7] } }),
        apiContext.post(`/v1/goals/${goal.id}/plan/time-advice`, {
          data: { weekendMinutes: 1441 },
        }),
        apiContext.post(`/v1/goals/${other.goal.id}/plan/time-advice`, { data: {} }),
        apiContext.post(`/v1/goals/${goal.id}/plan/time-advice`, { data: { fullCourse: true } }),
        apiContext.post(`/v1/goals/${goal.id}/plan/time-advice`, { data: { fullCourse: "yes" } }),
      ]);

    const advice = await readBody({ response: everyDay, schema: planTimeAdviceSchema });

    await expect(
      readBody({ response: everything, schema: planTimeAdviceSchema }),
    ).resolves.toMatchObject({ coveredShare: advice.coveredShare, fullCourseEndDate: null });

    expect(advice).toMatchObject({ measure: "goal", ready: true, targetDate });
    expect(advice.coveredShare).toBeLessThan(1);
    expect(advice.numbers).not.toBeNull();
    expect(advice.numbers?.context).toMatchObject({ dailyMinutes: 12, targetDate });

    const [everyDayBody, planBody] = await Promise.all([everyDay.json(), plan.json()]);
    expect(everyDayBody).not.toHaveProperty("recommendedMinutes");
    expect(planBody).not.toHaveProperty("feasibility.recommendedMinutes");

    await expect(
      readBody({ response: weekdays, schema: planTimeAdviceSchema }),
    ).resolves.toMatchObject({ ready: true });

    await expect(
      readBody({ response: weekend, schema: planTimeAdviceSchema }),
    ).resolves.toMatchObject({ ready: true });

    expect([
      invalid.status(),
      tooLong.status(),
      hidden.status(),
      badEverything.status(),
    ]).toStrictEqual([400, 400, 404, 400]);

    const [found, foundWeekdays, foundWeekend, badDays, badWeekend, foundHidden] =
      await Promise.all([
        apiContext.post(`/v1/goals/${goal.id}/plan/time-to-cover`, { data: {} }),
        apiContext.post(`/v1/goals/${goal.id}/plan/time-to-cover`, {
          data: { studyDays: [1, 2, 3, 4, 5] },
        }),
        apiContext.post(`/v1/goals/${goal.id}/plan/time-to-cover`, {
          data: { weekendMinutes: 120 },
        }),
        apiContext.post(`/v1/goals/${goal.id}/plan/time-to-cover`, { data: { studyDays: [7] } }),
        apiContext.post(`/v1/goals/${goal.id}/plan/time-to-cover`, {
          data: { weekendMinutes: 1441 },
        }),
        apiContext.post(`/v1/goals/${other.goal.id}/plan/time-to-cover`, { data: {} }),
      ]);

    const time = await readBody({ response: found, schema: planTimeToCoverSchema });

    expect(time).toMatchObject({ ready: true, targetDate });
    expect(time.recommendedMinutes).toBeGreaterThan(12);

    await expect(
      readBody({ response: foundWeekdays, schema: planTimeToCoverSchema }),
    ).resolves.toMatchObject({ ready: true });

    await expect(
      readBody({ response: foundWeekend, schema: planTimeToCoverSchema }),
    ).resolves.toMatchObject({ ready: true });

    expect([badDays.status(), badWeekend.status(), foundHidden.status()]).toStrictEqual([
      400, 400, 404,
    ]);

    await expect(
      readBody({
        response: await apiContext.post(`/v1/goals/${goal.id}/plan/time-advice`, { data: {} }),
        schema: planTimeAdviceSchema,
      }),
    ).resolves.toMatchObject({ coveredShare: advice.coveredShare });

    await apiContext.dispose();
  });

  test("says whether a plan changed since the client read it, for a screen waiting on lessons", async () => {
    const [{ apiContext, user }, stranger] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "plans-changed-since" }),
      userFixture(),
    ]);

    const [{ goal }, other] = await Promise.all([
      createPlannedGoal(user.id),
      createPlannedGoal(stranger.id),
    ]);

    const before = new Date(Date.now() - HOUR_MS).toISOString();
    const after = new Date(Date.now() + 5000).toISOString();
    const path = `/v1/goals/${goal.id}/plan/changed-since`;

    const [changed, unchanged, today, invalidTime, invalidWatch, missing, hidden] =
      await Promise.all([
        apiContext.get(`${path}?since=${before}`),
        apiContext.get(`${path}?since=${after}`),
        apiContext.get(`${path}?since=${after}&watch=today`),
        apiContext.get(`${path}?since=yesterday`),
        apiContext.get(`${path}?since=${after}&watch=week`),
        apiContext.get(path),
        apiContext.get(`/v1/goals/${other.goal.id}/plan/changed-since?since=${before}`),
      ]);

    await expect(
      readBody({ response: changed, schema: planChangedSinceSchema }),
    ).resolves.toStrictEqual({ changed: true });

    await expect(
      readBody({ response: unchanged, schema: planChangedSinceSchema }),
    ).resolves.toStrictEqual({ changed: false });

    await expect(
      readBody({ response: today, schema: planChangedSinceSchema }),
    ).resolves.toStrictEqual({ changed: false });

    expect(
      [invalidTime, invalidWatch, missing, hidden].map((response) => response.status()),
    ).toStrictEqual([400, 400, 400, 404]);

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

    // A plan reaches 3,650 days ahead: eleven years is past it.
    const tooFar = `${new Date().getUTCFullYear() + 11}-01-01`;

    const [read, hidden, hiddenPlan, pastDate, farDate] = await Promise.all([
      apiContext.get(`/v1/goals/${goal.id}`),
      apiContext.get(`/v1/goals/${other.goal.id}`),
      apiContext.get(`/v1/goals/${other.goal.id}/plan`),
      apiContext.patch(`/v1/goals/${goal.id}`, { data: { targetDate: "2020-01-01" } }),
      apiContext.patch(`/v1/goals/${goal.id}`, { data: { targetDate: tooFar } }),
    ]);

    await expect(readBody({ response: read, schema: goalSchema })).resolves.toMatchObject({
      title: "Markets",
    });

    expect(hidden.status()).toBe(404);
    expect(hiddenPlan.status()).toBe(404);
    expect(pastDate.status()).toBe(422);
    expect(farDate.status()).toBe(422);

    await expect(farDate.json()).resolves.toMatchObject({
      error: {
        code: "TARGET_DATE_OUT_OF_RANGE",
        details: [{ bound: "latest", path: ["targetDate"] }],
      },
    });

    await apiContext.dispose();
  });

  test("previews resuming a paused goal before the learner resumes it", async () => {
    const [{ apiContext, user }, stranger] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "goals-resume" }),
      userFixture(),
    ]);

    const [{ goal, plan }, other] = await Promise.all([
      createPlannedGoal(user.id),
      createPlannedGoal(stranger.id),
    ]);

    const preview = async () =>
      readBody({
        response: await apiContext.get(`/v1/goals/${goal.id}/plan/resume-preview`),
        schema: z.boolean(),
      });

    await apiContext.patch(`/v1/goals/${goal.id}`, { data: { status: "paused" } });

    await expect(preview()).resolves.toBe(false);

    const items = await prisma.planItem.findMany({ where: { planId: plan.id } });

    await Promise.all(
      items.map((item) =>
        prisma.planItem.update({
          data: { scheduledFor: new Date((item.scheduledFor?.getTime() ?? 0) - 3 * DAY_MS) },
          where: { id: item.id },
        }),
      ),
    );

    await expect(preview()).resolves.toBe(true);

    const [resumed, hidden] = await Promise.all([
      apiContext.patch(`/v1/goals/${goal.id}`, { data: { status: "active" } }),
      apiContext.get(`/v1/goals/${other.goal.id}/plan/resume-preview`),
    ]);

    await expect(
      readBody({ response: resumed, schema: goalUpdateResponseSchema }),
    ).resolves.toMatchObject({ change: { kind: "resumed" }, goal: { status: "active" } });

    expect(hidden.status()).toBe(404);
    await apiContext.dispose();
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
        phases: [{ kind: "learn", name: "The basics" }],
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

    await expect(prisma.goal.count({ where: { id: started.id, userId: user.id } })).resolves.toBe(
      1,
    );

    const missing = await anonymous.get(`/v1/plan-links/${randomUUID()}`);
    expect(missing.status()).toBe(404);

    await Promise.all([anonymous.dispose(), visitor.dispose()]);
  });
});
