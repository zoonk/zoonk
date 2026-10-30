import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getBudgetForMainGoal } from "../goals/daily-budget";
import { updateGoal } from "../goals/update-goal";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { answerOnboardingQuestion } from "../view-models/onboarding/answer-onboarding-question";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { roundShare } from "./_utils/plan-feasibility-view";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { findPlanTimeToCover, getPlanTimeAdvice } from "./get-time-advice";
import { endNoticeWait, startNoticeWait } from "./notice-wait";
import { runPlanSetupTask } from "./plan-setup";
import { parsePlanSettings } from "./planner/plan-state";
import { type PlanTimeAdviceInput } from "./time-advice-contract";

/** Before other tests' learning events, so their pace never changes these plans. */
const NOW = new Date("2020-09-28T12:00:00Z");
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

const WEEKEND_SCHEDULES = [
  {
    dailyMinutes: 170,
    lighter: false,
    name: "weekend only",
    studyDays: [0, 6],
    weekendMinutes: 60,
  },
  {
    dailyMinutes: 200,
    lighter: true,
    name: "lighter Tuesday and weekends",
    studyDays: [0, 2, 6],
    weekendMinutes: 30,
  },
  {
    dailyMinutes: 115,
    lighter: false,
    name: "Monday and weekends",
    studyDays: [0, 1, 6],
    weekendMinutes: 30,
  },
  {
    dailyMinutes: 170,
    lighter: false,
    name: "rested first Monday",
    studyDays: [0, 3, 6],
    weekendMinutes: 30,
  },
];

async function setup(lessons = 6, dailyMinutes = 5) {
  const user = await userFixture();

  const library = await planLibraryFixture({ skills: [{ lessons }, { lessons }, { lessons }] });

  const { goal } = await unplannedGoalFixture({
    dailyMinutes,
    settings: { startDate: "2020-09-28" },
    targetDate: new Date("2020-10-09T00:00:00Z"),
    userId: user.id,
  });

  mockSession(user.id);

  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: new Date("2020-09-28T00:00:00Z"),
    currentInstant: NOW,
    timeZone: "UTC",
  });

  return { goal, library, user };
}

async function readAdvice(goalId: string, studyDays: number[], week: PlanTimeAdviceInput = {}) {
  const [coverage, found] = await Promise.all([
    getPlanTimeAdvice({ goalId, input: { studyDays, ...week } }),
    findPlanTimeToCover({ goalId, input: { studyDays, weekendMinutes: week.weekendMinutes } }),
  ]);

  if (coverage.status !== "ready" || found.status !== "ready") {
    throw new Error(`Expected the time advice, got ${coverage.status} and ${found.status}`);
  }

  return { ...coverage.advice, recommendedMinutes: found.time.recommendedMinutes };
}

async function readPlanTime(goalId: string) {
  const result = await findPlanTimeToCover({ goalId, input: {} });

  if (result.status !== "ready") {
    throw new Error(`Expected the time that covers everything, got ${result.status}`);
  }

  return result.time;
}

async function readFeasibility(goalId: string) {
  const result = await getGoalPlan(goalId);

  if (result.status !== "ready") {
    throw new Error(`Expected the plan, got ${result.status}`);
  }

  return result.plan.feasibility;
}

function change(
  goalId: string,
  operations: Parameters<typeof changeGoalPlan>[0]["input"]["operations"],
) {
  return changeGoalPlan({ goalId, input: { operations, timeZone: "UTC" } });
}

describe(getPlanTimeAdvice, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("estimates an undated plan for the selected week without saving a deadline or schedule", async () => {
    const { goal, library } = await setup(18, 15);
    await prisma.goal.update({ data: { targetDate: null }, where: { id: goal.id } });
    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    const before = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    const ask = (input: PlanTimeAdviceInput) => getPlanTimeAdvice({ goalId: goal.id, input });

    const [short, long, weekdays, weekends] = await Promise.all([
      ask({ dailyMinutes: 15, studyDays: EVERY_DAY }),
      ask({ dailyMinutes: 30, studyDays: EVERY_DAY }),
      ask({ dailyMinutes: 15, studyDays: WEEKDAYS }),
      ask({ dailyMinutes: 15, studyDays: EVERY_DAY, weekendMinutes: 60 }),
    ]);

    if ([short, long, weekdays, weekends].some((result) => result.status !== "ready")) {
      throw new Error("Expected the time advice");
    }

    expect(short).toMatchObject({
      advice: { endDate: expect.any(String), ready: true, targetDate: null },
    });

    const end = (result: typeof short) =>
      result.status === "ready" ? (result.advice.endDate ?? "") : "";

    expect(Date.parse(end(long))).toBeLessThan(Date.parse(end(short)));
    expect(Date.parse(end(weekdays))).toBeGreaterThan(Date.parse(end(short)));
    expect(Date.parse(end(weekends))).toBeLessThan(Date.parse(end(short)));

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
    ).resolves.toStrictEqual(before);

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      dailyMinutes: 15,
      targetDate: null,
    });

    await updateGoal({
      goalId: goal.id,
      input: { dailyMinutes: 30, studyDays: EVERY_DAY, timeZone: "UTC" },
    });

    const saved = await getGoalPlan(goal.id);
    expect(saved.status === "ready" && saved.plan.estimate.endDate).toBe(end(long));
  });

  it("has no finish date when an undated plan cannot schedule the whole curriculum", async () => {
    const { goal, library } = await setup(0, 5);
    await prisma.goal.update({ data: { targetDate: null }, where: { id: goal.id } });

    const large = {
      ...library.graph,
      skills: library.graph.skills.map((skill) => ({ ...skill, lessons: 600 })),
    };

    await createGoalPlan({ goalId: goal.id, graph: large });

    await expect(
      getPlanTimeAdvice({ goalId: goal.id, input: { dailyMinutes: 5, studyDays: [0] } }),
    ).resolves.toMatchObject({ advice: { endDate: null, ready: true }, status: "ready" });
  });

  it("recommends the least fitting accepted time when more time adds an exam mock", async () => {
    const [user, library] = await Promise.all([
      userFixture(),
      planLibraryFixture({ skills: [{ area: "Math", lessons: 0, size: 11, weight: 1 }] }),
    ]);

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 60,
      examBlueprintId: null,
      kind: "exam",
      settings: { startDate: "2020-09-28" },
      targetDate: new Date("2020-10-16T00:00:00Z"),
      timezone: "UTC",
      userId: user.id,
    });

    mockSession(user.id);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date("2020-09-28T00:00:00Z"),
      currentInstant: NOW,
      timeZone: "UTC",
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const studyDays = [0];
    const advice = await readAdvice(goal.id, studyDays);
    const preview50 = await readAdvice(goal.id, studyDays, { dailyMinutes: 50 });
    const preview65 = await readAdvice(goal.id, studyDays, { dailyMinutes: 65 });
    const preview70 = await readAdvice(goal.id, studyDays, { dailyMinutes: 70 });

    expect(preview50.coveredShare).toBe(1);
    expect(preview65.coveredShare).toBe(1);
    expect(preview70.coveredShare).toBe(0.91);

    for (const dailyMinutes of Array.from({ length: 9 }, (_, index) => (index + 1) * 5)) {
      // eslint-disable-next-line no-await-in-loop -- Each candidate reads the previous accepted state.
      const preview = await readAdvice(goal.id, studyDays, { dailyMinutes });
      expect(preview.coveredShare).toBeLessThan(1);

      // eslint-disable-next-line no-await-in-loop -- Acceptances mutate the same learner's plan.
      const accepted = await updateGoal({
        goalId: goal.id,
        input: { dailyMinutes, studyDays, timeZone: "UTC" },
      });

      expect(accepted.status).toBe("updated");
      // eslint-disable-next-line no-await-in-loop -- Read the persisted result before accepting another time.
      const saved = await readFeasibility(goal.id);
      expect(saved?.fits).toBe(false);
      expect(roundShare(saved?.coveredShare ?? 0)).toBe(preview.coveredShare);
      // eslint-disable-next-line no-await-in-loop -- The time the Plan finds for the accepted week.
      const savedTime = await readPlanTime(goal.id);
      expect([preview.recommendedMinutes, savedTime.recommendedMinutes]).toStrictEqual([50, 50]);
    }

    await expect(
      updateGoal({ goalId: goal.id, input: { dailyMinutes: 65, studyDays, timeZone: "UTC" } }),
    ).resolves.toMatchObject({ status: "updated" });

    await expect(readFeasibility(goal.id)).resolves.toMatchObject({ coveredShare: 1, fits: true });
    await expect(readPlanTime(goal.id)).resolves.toMatchObject({ recommendedMinutes: 50 });

    const at65 = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    expect(parsePlanSettings(at65.settings).mockFunding.map((entry) => entry.date)).toStrictEqual([
      "2020-10-11",
    ]);

    const higher = await updateGoal({
      goalId: goal.id,
      input: { dailyMinutes: 70, studyDays, timeZone: "UTC" },
    });

    expect(higher.status).toBe("updated");
    const saved70 = await readFeasibility(goal.id);
    const time70 = await readPlanTime(goal.id);
    expect(saved70?.fits).toBe(false);
    expect(roundShare(saved70?.coveredShare ?? 0)).toBe(preview70.coveredShare);
    const at70 = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    expect(parsePlanSettings(at70.settings).mockFunding.map((entry) => entry.date)).toStrictEqual([
      "2020-10-04",
      "2020-10-11",
    ]);

    const accepted = await updateGoal({
      goalId: goal.id,
      input: { dailyMinutes: 50, studyDays, timeZone: "UTC" },
    });

    expect(accepted.status).toBe("updated");
    const at50 = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    expect(parsePlanSettings(at50.settings).mockFunding.map((entry) => entry.date)).toStrictEqual([
      "2020-10-11",
    ]);

    const plan = await getGoalPlan(goal.id);

    expect(plan).toMatchObject({
      plan: {
        feasibility: { coveredShare: 1, fits: true },
        schedule: { dailyMinutes: 50, weekdayMinutes: [50, 0, 0, 0, 0, 0, 0] },
      },
      status: "ready",
    });

    const planTime = await readPlanTime(goal.id);

    expect([
      advice.recommendedMinutes,
      preview50.recommendedMinutes,
      preview65.recommendedMinutes,
      preview70.recommendedMinutes,
      time70.recommendedMinutes,
      planTime.recommendedMinutes,
    ]).toStrictEqual([50, 50, 50, 50, 50, 50]);
  });

  it("recommends the time the plan then shows, and that time covers the whole goal", async () => {
    const { goal, library } = await setup();
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const advice = await readAdvice(goal.id, EVERY_DAY);

    expect(advice).toMatchObject({ measure: "goal", ready: true, targetDate: "2020-10-09" });
    expect(advice.recommendedMinutes).toBeGreaterThan(goal.dailyMinutes);

    await expect(readPlanTime(goal.id)).resolves.toMatchObject({
      pastDate: false,
      recommendedMinutes: advice.recommendedMinutes,
      suggested: { kind: "everything", minutes: advice.recommendedMinutes },
    });

    await change(goal.id, [{ kind: "setDailyMinutes", minutes: advice.recommendedMinutes ?? 0 }]);

    await expect(readFeasibility(goal.id)).resolves.toMatchObject({ coveredShare: 1 });

    await expect(readPlanTime(goal.id)).resolves.toMatchObject({
      recommendedMinutes: advice.recommendedMinutes,
    });
  });

  it("gives the main goal of goals typed together the time found for it when the learner takes the day it needs", async () => {
    const { goal, library, user } = await setup();
    const onboardingId = randomUUID();

    await prisma.goal.update({ data: { details: { onboardingId } }, where: { id: goal.id } });

    const { goal: other } = await unplannedGoalFixture({
      createdAt: new Date(NOW.getTime() + 1000),
      details: { onboardingId },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    const found = await readPlanTime(goal.id);
    const main = found.recommendedMinutes ?? 0;
    const day = getBudgetForMainGoal({ count: 2, main });

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { dailyMinutes: day, question: "schedule", timeZone: "UTC" },
    });

    await expect(
      prisma.goal.findMany({
        orderBy: { createdAt: "asc" },
        select: { dailyMinutes: true },
        where: { id: { in: [goal.id, other.id] } },
      }),
    ).resolves.toStrictEqual([{ dailyMinutes: main }, { dailyMinutes: day - main }]);

    await expect(readFeasibility(goal.id)).resolves.toMatchObject({ coveredShare: 1 });
  });

  it("says what the time the learner looks at covers, without changing the time recommended", async () => {
    const { goal, library } = await setup();
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const advice = await readAdvice(goal.id, EVERY_DAY);
    const recommended = advice.recommendedMinutes ?? 0;
    const between = Math.max(10, recommended - 5);

    const [some, all] = await Promise.all([
      readAdvice(goal.id, EVERY_DAY, { dailyMinutes: between }),
      readAdvice(goal.id, EVERY_DAY, { dailyMinutes: recommended }),
    ]);

    expect(advice.coveredShare).toBeGreaterThan(0);
    expect(advice.coveredShare).toBeLessThan(1);
    expect(some.coveredShare).toBeGreaterThan(advice.coveredShare ?? 1);
    expect(all.coveredShare).toBe(1);

    expect([some.recommendedMinutes, all.recommendedMinutes]).toStrictEqual([
      recommended,
      recommended,
    ]);

    await change(goal.id, [{ kind: "setDailyMinutes", minutes: between }]);

    await expect(readFeasibility(goal.id)).resolves.toMatchObject({
      coveredShare: some.coveredShare,
    });
  });

  it("on fewer study days recommends more a day: the number the plan shows once they're set", async () => {
    const { goal, library } = await setup();
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const [everyDay, weekdays] = await Promise.all([
      readAdvice(goal.id, EVERY_DAY),
      readAdvice(goal.id, WEEKDAYS),
    ]);

    expect(weekdays.recommendedMinutes).toBeGreaterThan(everyDay.recommendedMinutes ?? 0);

    await change(goal.id, [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [0, 6] }]);

    await expect(readPlanTime(goal.id)).resolves.toMatchObject({
      recommendedMinutes: weekdays.recommendedMinutes,
    });
  });

  it("counts the weekend's own time: the number the plan shows once the week is set", async () => {
    const { goal, library } = await setup(18);
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const [everyDay, withWeekend] = await Promise.all([
      readAdvice(goal.id, EVERY_DAY),
      readAdvice(goal.id, EVERY_DAY, { weekendMinutes: 60 }),
    ]);

    expect(withWeekend.recommendedMinutes).toBeLessThan(everyDay.recommendedMinutes ?? 0);

    await change(goal.id, [
      { kind: "setDailyMinutes", minutes: 10 },
      { kind: "setWeekdayMinutes", minutes: 60, weekdays: [0, 6] },
    ]);

    await expect(readPlanTime(goal.id)).resolves.toMatchObject({
      recommendedMinutes: withWeekend.recommendedMinutes,
    });

    await change(goal.id, [
      { kind: "setDailyMinutes", minutes: withWeekend.recommendedMinutes ?? 0 },
    ]);

    const plan = await getGoalPlan(goal.id);

    expect(plan.status === "ready" && plan.plan.schedule.weekdayMinutes).toStrictEqual([
      60,
      ...WEEKDAYS.map(() => withWeekend.recommendedMinutes),
      60,
    ]);

    await expect(readFeasibility(goal.id)).resolves.toMatchObject({ coveredShare: 1 });
  });

  it("measures a new daily time with the saved weekend time, as applying it does", async () => {
    const { goal, library } = await setup(18);
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    await change(goal.id, [
      { kind: "setDailyMinutes", minutes: 10 },
      { kind: "setWeekdayMinutes", minutes: 30, weekdays: [0, 6] },
    ]);

    const advice = await getPlanTimeAdvice({ goalId: goal.id, input: { dailyMinutes: 20 } });

    await change(goal.id, [{ kind: "setDailyMinutes", minutes: 20 }]);

    const feasibility = await readFeasibility(goal.id);

    if (!feasibility) {
      throw new Error("Expected plan feasibility");
    }

    expect(advice).toMatchObject({
      advice: { coveredShare: feasibility.coveredShare, ready: true },
      status: "ready",
    });
  });

  it("keeps lighter weekdays when recommending time with an unchanged weekend override", async () => {
    const { goal, library } = await setup(28, 60);
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    await change(goal.id, [
      { kind: "setWeekdayMinutes", minutes: 30, weekdays: [0, 6] },
      { kind: "setWeekdayMinutes", minutes: 5, weekdays: [2] },
    ]);

    const [plain, explicit] = await Promise.all([
      readAdvice(goal.id, EVERY_DAY),
      readAdvice(goal.id, EVERY_DAY, { weekendMinutes: 30 }),
    ]);

    expect(explicit.recommendedMinutes).toBe(plain.recommendedMinutes);
    expect(explicit.recommendedMinutes).toBeGreaterThan(60);

    const recommended = explicit.recommendedMinutes;

    if (recommended === null) {
      throw new Error("Expected a daily-time recommendation");
    }

    const picked = await readAdvice(goal.id, EVERY_DAY, {
      dailyMinutes: recommended,
      weekendMinutes: 30,
    });

    await change(goal.id, [{ kind: "setDailyMinutes", minutes: recommended }]);

    const feasibility = await readFeasibility(goal.id);

    expect(picked.coveredShare).toBe(1);

    expect(feasibility).toMatchObject({ coveredShare: picked.coveredShare, fits: true });
    await expect(readPlanTime(goal.id)).resolves.toMatchObject({ recommendedMinutes: recommended });
  });

  it.each(WEEKEND_SCHEDULES)(
    "matches updateGoal's saved coverage for $name",
    async ({ dailyMinutes, lighter, studyDays, weekendMinutes }) => {
      const { goal, library } = await setup(12, 60);
      await createGoalPlan({ goalId: goal.id, graph: library.graph });

      if (lighter) {
        await change(goal.id, [
          { kind: "setWeekdayMinutes", minutes: 30, weekdays: [0, 6] },
          { kind: "setWeekdayMinutes", minutes: 5, weekdays: [2] },
        ]);
      }

      const input = { dailyMinutes, studyDays, weekendMinutes };
      const picked = await readAdvice(goal.id, studyDays, input);
      const result = await updateGoal({ goalId: goal.id, input: { ...input, timeZone: "UTC" } });
      expect(result.status).toBe("updated");

      const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
      expect(saved.dailyMinutes).toBe(weekendMinutes);

      await expect(readFeasibility(goal.id)).resolves.toMatchObject({
        coveredShare: picked.coveredShare,
      });
    },
  );

  it.each(WEEKEND_SCHEDULES)(
    "offers only an achievable recommendation for $name",
    async ({ lighter, studyDays, weekendMinutes }) => {
      const { goal, library } = await setup(12, 60);
      await createGoalPlan({ goalId: goal.id, graph: library.graph });

      if (lighter) {
        await change(goal.id, [
          { kind: "setWeekdayMinutes", minutes: 30, weekdays: [0, 6] },
          { kind: "setWeekdayMinutes", minutes: 5, weekdays: [2] },
        ]);
      }

      const input = { studyDays, weekendMinutes };
      const advice = await readAdvice(goal.id, studyDays, input);

      const recommended = advice.recommendedMinutes ?? goal.dailyMinutes;
      const promisedCoverage = advice.recommendedMinutes === null ? advice.coveredShare : 1;

      const picked = await readAdvice(goal.id, studyDays, { ...input, dailyMinutes: recommended });

      const result = await updateGoal({
        goalId: goal.id,
        input: { ...input, dailyMinutes: recommended, timeZone: "UTC" },
      });

      expect(result.status).toBe("updated");

      const feasibility = await readFeasibility(goal.id);
      expect(feasibility?.coveredShare).toBe(picked.coveredShare);

      expect(feasibility).toMatchObject({
        coveredShare: promisedCoverage,
        fits: promisedCoverage === 1,
      });
    },
  );

  it("offers no daily-time increase when weekend-only candidates save the same schedule", async () => {
    const { goal, library } = await setup(12, 60);
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const input = { studyDays: [0, 6], weekendMinutes: 60 };

    const [least, most] = await Promise.all([
      readAdvice(goal.id, input.studyDays, { ...input, dailyMinutes: 5 }),
      readAdvice(goal.id, input.studyDays, { ...input, dailyMinutes: 240 }),
    ]);

    expect(least).toMatchObject({ coveredShare: 0.83, recommendedMinutes: null });
    expect(most).toStrictEqual(least);

    await expect(
      updateGoal({ goalId: goal.id, input: { ...input, timeZone: "UTC" } }),
    ).resolves.toMatchObject({ status: "updated" });

    await expect(readFeasibility(goal.id)).resolves.toMatchObject({
      coveredShare: least.coveredShare,
    });
  });

  it("recommends more than 4 hours on weekdays when the weekend's 4 hours don't cover it", async () => {
    const { goal, library } = await setup(60, 60);
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const input = { dailyMinutes: 5, studyDays: [0, 1, 6], weekendMinutes: 240 };
    const advice = await readAdvice(goal.id, input.studyDays, input);
    expect(advice.recommendedMinutes).toBeGreaterThan(240);

    const result = await updateGoal({
      goalId: goal.id,
      input: { ...input, dailyMinutes: advice.recommendedMinutes ?? 0, timeZone: "UTC" },
    });

    expect(result.status).toBe("updated");
    await expect(readFeasibility(goal.id)).resolves.toMatchObject({ coveredShare: 1, fits: true });
  });

  it("can preview and accept replacing all saved study days", async () => {
    const { goal, library } = await setup(12, 60);
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    await updateGoal({
      goalId: goal.id,
      input: { studyDays: [0, 6], timeZone: "UTC", weekendMinutes: 60 },
    });

    const input = { dailyMinutes: 20, studyDays: WEEKDAYS };
    const picked = await readAdvice(goal.id, WEEKDAYS, input);
    const result = await updateGoal({ goalId: goal.id, input: { ...input, timeZone: "UTC" } });
    expect(result.status).toBe("updated");

    await expect(readFeasibility(goal.id)).resolves.toMatchObject({
      coveredShare: picked.coveredShare,
    });
  });

  it("keeps the number however other learners' lessons went since", async () => {
    const { goal, library } = await setup();
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const before = await readAdvice(goal.id, EVERY_DAY);
    const other = await userFixture();

    // Other learners' slower lessons, removed after so no other test's plan reads them.
    await Promise.all(
      Array.from({ length: 24 }, (_, index) =>
        learningEventFixture({
          contentIds: { lessonId: library.lessons[index % library.lessons.length]?.id },
          endedAt: new Date("2020-09-27T12:00:00Z"),
          seconds: 360,
          userId: other.id,
        }),
      ),
    );

    try {
      await expect(readAdvice(goal.id, EVERY_DAY)).resolves.toStrictEqual(before);

      await change(goal.id, [{ kind: "setDailyMinutes", minutes: 6 }]);

      await expect(readPlanTime(goal.id)).resolves.toMatchObject({
        recommendedMinutes: before.recommendedMinutes,
      });

      await change(goal.id, [{ kind: "setDailyMinutes", minutes: before.recommendedMinutes ?? 0 }]);

      await expect(readFeasibility(goal.id)).resolves.toMatchObject({ coveredShare: 1 });

      await expect(readPlanTime(goal.id)).resolves.toMatchObject({
        recommendedMinutes: before.recommendedMinutes,
      });
    } finally {
      await prisma.learningEvent.deleteMany({ where: { userId: other.id } });
    }
  });

  it("says when studying everything ends for an exam, only once that plan holds all of it", async () => {
    const [user, library] = await Promise.all([
      userFixture(),
      planLibraryFixture({ skills: [{ area: "Math", lessons: 0, size: 600, weight: 1 }] }),
    ]);

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 60,
      examBlueprintId: null,
      kind: "exam",
      settings: { startDate: "2020-09-28" },
      targetDate: new Date("2020-10-16T00:00:00Z"),
      timezone: "UTC",
      userId: user.id,
    });

    mockSession(user.id);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date("2020-09-28T00:00:00Z"),
      currentInstant: NOW,
      timeZone: "UTC",
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const ask = (input: PlanTimeAdviceInput) => getPlanTimeAdvice({ goalId: goal.id, input });

    const [own, everything, sundays, wholeDays] = await Promise.all([
      ask({ dailyMinutes: 60, studyDays: EVERY_DAY }),
      ask({ dailyMinutes: 60, fullCourse: true, studyDays: EVERY_DAY }),
      ask({ dailyMinutes: 5, fullCourse: true, studyDays: [0] }),
      ask({ dailyMinutes: 1440, fullCourse: true, studyDays: EVERY_DAY }),
    ]);

    if (
      own.status !== "ready" ||
      everything.status !== "ready" ||
      sundays.status !== "ready" ||
      wholeDays.status !== "ready"
    ) {
      throw new Error("Expected the time advice");
    }

    expect(own.advice).toMatchObject({ fullCourseEndDate: null, ready: true });
    expect(own.advice.coveredShare).toBeLessThan(1);

    expect(everything.advice.coveredShare).toBe(own.advice.coveredShare);
    expect(everything.advice.fullCourseEndDate).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect((everything.advice.fullCourseEndDate ?? "") > "2020-10-16").toBe(true);

    expect(sundays.advice).toMatchObject({ fullCourseEndDate: null, ready: true });
    expect(wholeDays.advice).toMatchObject({ coveredShare: 1, fullCourseEndDate: null });
  });

  it("says on the Plan when studying everything ends, only while its plan holds all of it", async () => {
    const [user, library] = await Promise.all([
      userFixture(),
      planLibraryFixture({ skills: [{ area: "Math", lessons: 0, size: 600, weight: 1 }] }),
    ]);

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 60,
      examBlueprintId: null,
      kind: "exam",
      settings: { startDate: "2020-09-28" },
      targetDate: new Date("2020-10-16T00:00:00Z"),
      timezone: "UTC",
      userId: user.id,
    });

    mockSession(user.id);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date("2020-09-28T00:00:00Z"),
      currentInstant: NOW,
      timeZone: "UTC",
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const readEstimate = async () => {
      const result = await getGoalPlan(goal.id);

      if (result.status !== "ready") {
        throw new Error(`Expected the plan, got ${result.status}`);
      }

      return result.plan.estimate;
    };

    await expect(readEstimate()).resolves.toMatchObject({ fullCourseEndDate: null });

    await expect(
      change(goal.id, [{ fullCourse: true, kind: "setFullCourse" }]),
    ).resolves.toMatchObject({ status: "applied" });

    const everything = await readEstimate();
    expect(everything.fullCourseEndDate).toBe(everything.endDate);
    expect((everything.fullCourseEndDate ?? "") > "2020-10-16").toBe(true);

    await expect(
      updateGoal({ goalId: goal.id, input: { dailyMinutes: 5, studyDays: [0], timeZone: "UTC" } }),
    ).resolves.toMatchObject({ status: "updated" });

    const sundays = await readEstimate();
    expect(sundays.endDate).not.toBeNull();
    expect(sundays.fullCourseEndDate).toBeNull();

    await expect(
      updateGoal({
        goalId: goal.id,
        input: { dailyMinutes: 1440, studyDays: EVERY_DAY, timeZone: "UTC" },
      }),
    ).resolves.toMatchObject({ status: "updated" });

    const wholeDays = await readEstimate();
    expect((wholeDays.endDate ?? "") <= "2020-10-16").toBe(true);
    expect(wholeDays.fullCourseEndDate).toBeNull();
  });

  it("says the plan isn't ready while it's being built", async () => {
    const { goal } = await setup();

    await expect(readAdvice(goal.id, EVERY_DAY)).resolves.toStrictEqual({
      coveredShare: null,
      endDate: null,
      fullCourseEndDate: null,
      measure: "goal",
      numbers: null,
      readingNotice: false,
      ready: false,
      recommendedMinutes: null,
      targetDate: null,
      targetDateNamedMonth: false,
    });
  });

  it("waits for the placement the learner ended before the plan existed, then recommends the plan's time", async () => {
    const { goal, library } = await setup();
    await createGoalPlan({ goalId: goal.id, graph: library.graph, setup: "steps" });

    await expect(readAdvice(goal.id, EVERY_DAY)).resolves.toMatchObject({
      ready: false,
      recommendedMinutes: null,
    });

    await runPlanSetupTask({ goalId: goal.id, task: "placement" });

    const advice = await readAdvice(goal.id, EVERY_DAY);

    expect(advice).toMatchObject({ ready: true });

    await expect(readPlanTime(goal.id)).resolves.toMatchObject({
      recommendedMinutes: advice.recommendedMinutes,
    });
  });

  it("waits while the plan waits for its exam's notice reading, then recommends the plan's time", async () => {
    const { goal, library } = await setup();
    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    await startNoticeWait({ goalId: goal.id, now: NOW });

    await expect(readAdvice(goal.id, EVERY_DAY)).resolves.toMatchObject({
      readingNotice: true,
      ready: false,
      recommendedMinutes: null,
    });

    await endNoticeWait(goal.id);

    const advice = await readAdvice(goal.id, EVERY_DAY);

    expect(advice).toMatchObject({ readingNotice: false, ready: true });

    await expect(readPlanTime(goal.id)).resolves.toMatchObject({
      recommendedMinutes: advice.recommendedMinutes,
    });
  });

  it("recommends the plan's time once its wait for the notice runs out without a reading", async () => {
    const { goal, library } = await setup();
    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    await startNoticeWait({ goalId: goal.id, now: new Date(NOW.getTime() - 7 * 60_000) });

    const advice = await readAdvice(goal.id, EVERY_DAY);

    expect(advice).toMatchObject({ readingNotice: false, ready: true });

    await expect(readPlanTime(goal.id)).resolves.toMatchObject({
      recommendedMinutes: advice.recommendedMinutes,
    });
  });

  it("asks a language goal for the hours that reach the level aimed for, and keeps new lessons to the date", async () => {
    const user = await userFixture();

    const library = await planLibraryFixture({
      skills: [{ lessons: 6 }, { lessons: 6 }, { lessons: 6 }],
    });

    const interview = new Date("2020-12-28T00:00:00Z");

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 45,
      details: { level: "B1+", targetScore: "B2" },
      kind: "language",
      settings: { startDate: "2020-09-28", weekdayMinutes: [0, 45, 45, 45, 45, 45, 0] },
      targetDate: interview,
      targetLanguage: "en",
      userId: user.id,
    });

    mockSession(user.id);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date("2020-09-28T00:00:00Z"),
      currentInstant: NOW,
      timeZone: "UTC",
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const stored = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const graph = stored.graph as { skills: { lessons: number }[] };
    expect(graph.skills.reduce((total, skill) => total + skill.lessons, 0)).toBe(656);

    const items = await prisma.planItem.findMany({ where: { planId: plan.id } });
    const lastWeek = new Date("2020-12-21T00:00:00Z").getTime();

    expect(items.filter((item) => item.kind === "review")).toStrictEqual([]);

    expect(
      items.find((item) => item.kind === "boss")?.scheduledFor?.getTime(),
    ).toBeGreaterThanOrEqual(lastWeek);

    const advice = await readAdvice(goal.id, WEEKDAYS);
    expect(advice.recommendedMinutes).toBeGreaterThan(60);
  });

  it("reads only the learner's own goal", async () => {
    const { goal, library } = await setup();
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const stranger = await userFixture();
    mockSession(stranger.id);

    await expect(
      getPlanTimeAdvice({ goalId: goal.id, input: { studyDays: EVERY_DAY } }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
