import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { planChangeSchema } from "@zoonk/core/plans/change-contract";
import { planChangedSinceSchema } from "@zoonk/core/plans/changed-since-contract";
import { planChangePreviewSchema } from "@zoonk/core/plans/preview-contract";
import { planTimeAdviceSchema } from "@zoonk/core/plans/time-advice-contract";
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
import { goalPreparationResponseSchema } from "../src/lib/openapi/schemas/preparation";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { readBody } from "./helpers/response";

const LESSONS = 12;
const LESSONS_PER_DAY = 4;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/**
 * A goal whose plan has its skill graph (what the goal-driven workflow writes) and a Library chapter
 * with twelve 3-minute lessons for its one skill, for a public course, planned four a day from today
 * as the planner lays them out at 12 minutes a day.
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

  const today = Math.floor(Date.now() / DAY_MS) * DAY_MS;

  await Promise.all(
    lessons.map((lesson, position) =>
      planItemFixture({
        lessonId: lesson.id,
        planId: plan.id,
        position,
        scheduledFor: new Date(today + Math.floor(position / LESSONS_PER_DAY) * DAY_MS),
        skillId: skill.id,
        titleSnapshot: lesson.title,
      }),
    ),
  );

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
      apiContext.get(`/v1/goals/${goalId}/plan/time-advice`),
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

  test("reads finished pace in plan and preparation responses", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL: process.env.E2E_BASE_URL ?? "",
      prefix: "plan-finished-status",
    });

    const { goal, plan } = await createPlannedGoal(user.id);

    await prisma.planItem.updateMany({ data: { status: "done" }, where: { planId: plan.id } });

    const [planResponse, preparationResponse] = await Promise.all([
      apiContext.get(`/v1/goals/${goal.id}/plan`),
      apiContext.get(`/v1/goals/${goal.id}/preparation`),
    ]);

    const [planView, preparation] = await Promise.all([
      readBody({ response: planResponse, schema: planResponseSchema }),
      readBody({ response: preparationResponse, schema: goalPreparationResponseSchema }),
    ]);

    expect(planView).toMatchObject({
      end: { kind: "finished" },
      pastDateOffer: null,
      status: { kind: "finished" },
    });

    expect(preparation.status).toStrictEqual({ kind: "finished" });
    await apiContext.dispose();
  });

  // Lucas's date came with lessons left: his plan read "ended". It keeps going: the plan offers the
  // change that does it, which clients send back as it is.
  test("offers the change that keeps a plan going once its date came with lessons left", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL: process.env.E2E_BASE_URL ?? "",
      prefix: "plan-past-date",
    });

    const { goal, plan } = await createPlannedGoal(user.id);
    const today = Math.floor(Date.now() / DAY_MS) * DAY_MS;
    const date = new Date(today - 3 * DAY_MS);

    // Four lessons studied before the date; the new day's settling set the rest aside.
    await Promise.all([
      prisma.goal.update({ data: { targetDate: date }, where: { id: goal.id } }),
      prisma.planItem.updateMany({
        data: { scheduledFor: new Date(today - 4 * DAY_MS), status: "skipped" },
        where: { planId: plan.id, position: { gte: LESSONS_PER_DAY } },
      }),
      prisma.planItem.updateMany({
        data: { scheduledFor: new Date(today - 5 * DAY_MS), status: "done" },
        where: { planId: plan.id, position: { lt: LESSONS_PER_DAY } },
      }),
    ]);

    const left = LESSONS - LESSONS_PER_DAY;

    const [planView, preparation] = await Promise.all([
      readBody({
        response: await apiContext.get(`/v1/goals/${goal.id}/plan`),
        schema: planResponseSchema,
      }),
      readBody({
        response: await apiContext.get(`/v1/goals/${goal.id}/preparation`),
        schema: goalPreparationResponseSchema,
      }),
    ]);

    expect(planView).toMatchObject({ end: null, status: { kind: "pastDate", lessons: left } });
    expect(preparation.status).toStrictEqual({ kind: "pastDate", lessons: left });

    const offer = planView.pastDateOffer;
    const [operation] = offer?.operations ?? [];
    const todayIso = new Date(today).toISOString().slice(0, 10);

    const targetDate = operation?.kind === "setTargetDate" ? operation.targetDate : null;

    expect(offer?.effect.lessonsAdded).toBe(left);
    expect(targetDate && targetDate > todayIso).toBe(true);

    const changed = await readBody({
      response: await apiContext.post(`/v1/goals/${goal.id}/plan/changes`, {
        data: { operations: offer?.operations ?? [] },
      }),
      schema: planChangeResultSchema,
    });

    expect(changed.status).toBe("applied");

    const after = await readBody({
      response: await apiContext.get(`/v1/goals/${goal.id}/plan`),
      schema: planResponseSchema,
    });

    expect(after.status?.kind).not.toBe("pastDate");
    expect(after.pastDateOffer).toBeNull();

    expect(after.schedule.targetDate).toBe(targetDate);

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

    // "Got it" only marks it read: it stays applied and can still be undone.
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

    // The plan's one area already has every lesson in it: focusing it moves nothing, so nothing
    // is saved and the answer says why.
    const noFocusGain = await readBody({
      response: await apiContext.post(`/v1/goals/${goal.id}/plan/changes`, {
        data: { operations: [{ areas: ["Markets"], kind: "focusAreas" }] },
      }),
      schema: planChangeResultSchema,
    });

    expect(noFocusGain).toStrictEqual({ change: null, reason: "alreadyIn", status: "unchanged" });

    // Starting an area past its basics is a change the learner can make like any other.
    const pastBasics = await readBody({
      response: await apiContext.post(`/v1/goals/${goal.id}/plan/changes`, {
        data: { operations: [{ areas: ["Markets"], kind: "setAreaStart", start: "pastBasics" }] },
      }),
      schema: planChangeResultSchema,
    });

    expect(pastBasics).toMatchObject({ status: "applied" });

    await apiContext.dispose();
  });

  test("recommends the daily time that covers the goal by its date: the one the plan shows", async () => {
    const [{ apiContext, user }, stranger] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "plans-time-advice" }),
      userFixture(),
    ]);

    const [{ goal }, other] = await Promise.all([
      createPlannedGoal(user.id),
      createPlannedGoal(stranger.id),
    ]);

    // Due the day after tomorrow: twelve 3-minute lessons don't fit in 12 minutes a day.
    const targetDate = new Date(Date.now() + 2 * DAY_MS).toISOString().slice(0, 10);

    await prisma.goal.update({
      data: { targetDate: new Date(`${targetDate}T00:00:00Z`) },
      where: { id: goal.id },
    });

    const [everyDay, weekdays, weekend, plan, invalid, tooLong, hidden] = await Promise.all([
      apiContext.get(`/v1/goals/${goal.id}/plan/time-advice`),
      apiContext.get(`/v1/goals/${goal.id}/plan/time-advice?studyDays=1,2,3,4,5`),
      apiContext.get(`/v1/goals/${goal.id}/plan/time-advice?weekendMinutes=120`),
      apiContext.get(`/v1/goals/${goal.id}/plan`),
      apiContext.get(`/v1/goals/${goal.id}/plan/time-advice?studyDays=7`),
      apiContext.get(`/v1/goals/${goal.id}/plan/time-advice?weekendMinutes=999`),
      apiContext.get(`/v1/goals/${other.goal.id}/plan/time-advice`),
    ]);

    const advice = await readBody({ response: everyDay, schema: planTimeAdviceSchema });

    expect(advice).toMatchObject({ measure: "goal", ready: true, targetDate });
    expect(advice.recommendedMinutes).toBeGreaterThan(12);
    expect(advice.numbers).not.toBeNull();
    expect(advice.numbers?.context).toMatchObject({ dailyMinutes: 12, targetDate });

    expect(advice.numbers?.coverage).toMatchObject({
      basis: "graphSized",
      coveredShare: advice.coveredShare,
      measure: "goal",
      scope: "selectedCurriculum",
    });

    expect(advice.numbers?.scheduledMinutes).toBe(
      Object.values(advice.numbers!.workload).reduce((sum, minutes) => sum + minutes, 0),
    );

    const visiblePlan = await readBody({ response: plan, schema: planResponseSchema });

    expect(visiblePlan).toMatchObject({
      feasibility: { recommendedMinutes: advice.recommendedMinutes },
    });

    expect(visiblePlan.numbers?.context).toEqual(advice.numbers?.context);
    expect(visiblePlan.numbers?.coverage?.coveredShare).toBe(visiblePlan.feasibility?.coveredShare);

    expect(visiblePlan.numbers?.scheduledMinutes).toBe(
      Object.values(visiblePlan.numbers!.workload).reduce((sum, minutes) => sum + minutes, 0),
    );

    await expect(
      readBody({ response: weekdays, schema: planTimeAdviceSchema }),
    ).resolves.toMatchObject({ ready: true });

    // The weekend's own time is part of the week asked about (core's tests check what it changes).
    await expect(
      readBody({ response: weekend, schema: planTimeAdviceSchema }),
    ).resolves.toMatchObject({ ready: true });

    expect([invalid.status(), tooLong.status(), hidden.status()]).toStrictEqual([400, 400, 404]);

    // The time question's estimate: what the time a day the learner looks at covers by the date,
    // all of it at the time recommended, and never another time recommended.
    const [atRecommended, atLeast, tooMuch] = await Promise.all([
      apiContext.get(
        `/v1/goals/${goal.id}/plan/time-advice?dailyMinutes=${advice.recommendedMinutes}`,
      ),
      apiContext.get(`/v1/goals/${goal.id}/plan/time-advice?dailyMinutes=5`),
      apiContext.get(`/v1/goals/${goal.id}/plan/time-advice?dailyMinutes=999`),
    ]);

    await expect(
      readBody({ response: atRecommended, schema: planTimeAdviceSchema }),
    ).resolves.toMatchObject({ coveredShare: 1, recommendedMinutes: advice.recommendedMinutes });

    const least = await readBody({ response: atLeast, schema: planTimeAdviceSchema });

    expect(least.coveredShare).toBeLessThan(1);
    expect(least.recommendedMinutes).toBe(advice.recommendedMinutes);
    expect(tooMuch.status()).toBe(400);

    /** The first day rests: its budget must use the scalar that accepting the weekend saves. */
    const weekday = new Date().getUTCDay();
    const studyDays = [0, 6].filter((day) => day !== weekday);

    const weekendOnly = await readBody({
      response: await apiContext.get(
        `/v1/goals/${goal.id}/plan/time-advice?dailyMinutes=240&studyDays=${studyDays.join(",")}&weekendMinutes=5`,
      ),
      schema: planTimeAdviceSchema,
    });

    expect(weekendOnly).toMatchObject({ maximum: null, recommendedMinutes: null });
    expect(weekendOnly.coveredShare).toBeLessThan(1);

    await expect(
      readBody({
        response: await apiContext.patch(`/v1/goals/${goal.id}`, {
          data: { dailyMinutes: 240, studyDays, timeZone: "UTC", weekendMinutes: 5 },
        }),
        schema: goalUpdateResponseSchema,
      }),
    ).resolves.toMatchObject({ goal: { dailyMinutes: 5 } });

    await expect(
      readBody({
        response: await apiContext.get(`/v1/goals/${goal.id}/plan`),
        schema: planResponseSchema,
      }),
    ).resolves.toMatchObject({ feasibility: { coveredShare: weekendOnly.coveredShare } });

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

    // Core's tests cover which writes count; here, a read from before the plan was saved and one
    // from after it (writes up to two seconds before a read still count).
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
        schema: planChangePreviewSchema,
      });

    await apiContext.patch(`/v1/goals/${goal.id}`, { data: { status: "paused" } });

    // Resumed the day it paused, the plan stays as it is.
    await expect(preview()).resolves.toMatchObject({ ready: true, unchanged: true });

    // Days went by while it was paused: their lessons are now on days past.
    const items = await prisma.planItem.findMany({ where: { planId: plan.id } });

    await Promise.all(
      items.map((item) =>
        prisma.planItem.update({
          data: { scheduledFor: new Date((item.scheduledFor?.getTime() ?? 0) - 3 * DAY_MS) },
          where: { id: item.id },
        }),
      ),
    );

    await expect(preview()).resolves.toMatchObject({
      effect: expect.any(Object),
      ready: true,
      unchanged: false,
    });

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
