import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { getPlanTimeAdvice } from "./get-time-advice";
import { endNoticeWait, startNoticeWait } from "./notice-wait";
import { runPlanSetupTask } from "./plan-setup";
import { type PlanTimeAdviceInput } from "./time-advice-contract";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

/**
 * A Monday in 2020, before the learning events other tests write: estimates read everyone's recent
 * pace, and this keeps it out of the numbers these tests expect.
 */
const NOW = new Date("2020-09-28T12:00:00Z");
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

/** A goal due in under two weeks whose 5 minutes a day can't cover its lessons. */
async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: [{ lessons: 6 }, { lessons: 6 }, { lessons: 6 }],
  });

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 5,
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
  const result = await getPlanTimeAdvice({ goalId, input: { studyDays, ...week } });

  if (result.status !== "ready") {
    throw new Error(`Expected the time advice, got ${result.status}`);
  }

  return result.advice;
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

/*
 * Onboarding's time question recommends the daily time that covers the whole goal by its date, and
 * the plan reveal and the Journey show the time it needs from the same plan: the learner must never
 * be told one number before the plan and another right after.
 */
describe(getPlanTimeAdvice, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("recommends the time the plan then shows, and that time covers the whole goal", async () => {
    const { goal, library } = await setup();
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const advice = await readAdvice(goal.id, EVERY_DAY);

    expect(advice).toMatchObject({ measure: "goal", ready: true, targetDate: "2020-10-09" });
    expect(advice.recommendedMinutes).toBeGreaterThan(goal.dailyMinutes);

    await expect(readFeasibility(goal.id)).resolves.toMatchObject({
      recommendedMinutes: advice.recommendedMinutes,
    });

    await change(goal.id, [{ kind: "setDailyMinutes", minutes: advice.recommendedMinutes ?? 0 }]);

    await expect(readFeasibility(goal.id)).resolves.toMatchObject({
      coveredShare: 1,
      recommendedMinutes: advice.recommendedMinutes,
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

    await expect(readFeasibility(goal.id)).resolves.toMatchObject({
      recommendedMinutes: weekdays.recommendedMinutes,
    });
  });

  // The time step recommended the same time a day with two hours on weekends as without them.
  it("counts the weekend's own time: the number the plan shows once the week is set", async () => {
    const { goal, library } = await setup();
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const [everyDay, withWeekend] = await Promise.all([
      readAdvice(goal.id, EVERY_DAY),
      readAdvice(goal.id, EVERY_DAY, { weekendMinutes: 30 }),
    ]);

    expect(withWeekend.recommendedMinutes).toBeLessThan(everyDay.recommendedMinutes ?? 0);

    // The week onboarding saves: 10 minutes on weekdays, the weekend's own 30.
    await change(goal.id, [
      { kind: "setDailyMinutes", minutes: 10 },
      { kind: "setWeekdayMinutes", minutes: 30, weekdays: [0, 6] },
    ]);

    await expect(readFeasibility(goal.id)).resolves.toMatchObject({
      recommendedMinutes: withWeekend.recommendedMinutes,
    });

    // Switching to it, as the reveal's one tap does, covers the goal and leaves the weekend as is.
    await change(goal.id, [
      { kind: "setDailyMinutes", minutes: withWeekend.recommendedMinutes ?? 0 },
    ]);

    const plan = await getGoalPlan(goal.id);

    expect(plan.status === "ready" && plan.plan.schedule.weekdayMinutes).toStrictEqual([
      30,
      ...WEEKDAYS.map(() => withWeekend.recommendedMinutes),
      30,
    ]);

    await expect(readFeasibility(goal.id)).resolves.toMatchObject({ coveredShare: 1 });
  });

  it("keeps the number however other learners' lessons went since", async () => {
    const { goal, library } = await setup();
    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const before = await readAdvice(goal.id, EVERY_DAY);
    const other = await userFixture();

    // Other learners took twice as long on this plan's lessons the day before; removed after, so
    // no other test's plan reads them.
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

      // Choosing less, the plan still recommends the same time, and switching to it, as the
      // reveal's one tap does, covers the whole goal.
      await change(goal.id, [{ kind: "setDailyMinutes", minutes: 6 }]);

      await expect(readFeasibility(goal.id)).resolves.toMatchObject({
        recommendedMinutes: before.recommendedMinutes,
      });

      await change(goal.id, [{ kind: "setDailyMinutes", minutes: before.recommendedMinutes ?? 0 }]);

      await expect(readFeasibility(goal.id)).resolves.toMatchObject({
        coveredShare: 1,
        recommendedMinutes: before.recommendedMinutes,
      });
    } finally {
      await prisma.learningEvent.deleteMany({ where: { userId: other.id } });
    }
  });

  it("says the plan isn't ready while it's being built", async () => {
    const { goal } = await setup();

    await expect(readAdvice(goal.id, EVERY_DAY)).resolves.toStrictEqual({
      maximum: null,
      measure: "goal",
      readingNotice: false,
      ready: false,
      recommendedMinutes: null,
      targetDate: null,
      targetDateNamedMonth: false,
    });
  });

  // A plan built after the learner ended placement tests lessons out in its setup step: asked
  // before that step, the time question would recommend more than the plan then shows.
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

    await expect(readFeasibility(goal.id)).resolves.toMatchObject({
      recommendedMinutes: advice.recommendedMinutes,
    });
  });

  // A reading of the exam's notice that lands while the reveal waits builds the plan again with it:
  // DELE's time question said 2h50 a day, and the plan, built again with the notice right after,
  // said 2h40.
  it("waits while the plan waits for its exam's notice reading, then recommends the plan's time", async () => {
    const { goal, library } = await setup();
    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    await startNoticeWait({ goalId: goal.id, now: NOW });

    // The time screen says what it waits for.
    await expect(readAdvice(goal.id, EVERY_DAY)).resolves.toMatchObject({
      readingNotice: true,
      ready: false,
      recommendedMinutes: null,
    });

    await endNoticeWait(goal.id);

    const advice = await readAdvice(goal.id, EVERY_DAY);

    expect(advice).toMatchObject({ readingNotice: false, ready: true });

    await expect(readFeasibility(goal.id)).resolves.toMatchObject({
      recommendedMinutes: advice.recommendedMinutes,
    });
  });

  // A reading that fails or never lands doesn't hold the time question: once the plan's wait for it
  // runs out, the reveal shows the plan as it is, and so does the advice.
  it("recommends the plan's time once its wait for the notice runs out without a reading", async () => {
    const { goal, library } = await setup();
    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    await startNoticeWait({ goalId: goal.id, now: new Date(NOW.getTime() - 7 * 60_000) });

    const advice = await readAdvice(goal.id, EVERY_DAY);

    expect(advice).toMatchObject({ readingNotice: false, ready: true });

    await expect(readFeasibility(goal.id)).resolves.toMatchObject({
      recommendedMinutes: advice.recommendedMinutes,
    });
  });

  it("asks a language goal for the hours that reach the level aimed for, and keeps new lessons to the date", async () => {
    const user = await userFixture();

    // Three interview situations the Library teaches in six lessons each so far.
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

    // B1+ to B2 is about 88 guided hours (Cambridge English): 656 four-minute lessons, half of each
    // study day, the rest reviews and practice.
    const stored = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const graph = stored.graph as { skills: { lessons: number }[] };
    expect(graph.skills.reduce((total, skill) => total + skill.lessons, 0)).toBe(656);

    // 45 minutes on weekdays can't hold that by the interview: new lessons fill every week to it,
    // with no weeks of review alone, and the last phase closes in the interview's week.
    const items = await prisma.planItem.findMany({ where: { planId: plan.id } });
    const lastWeek = new Date("2020-12-21T00:00:00Z").getTime();

    expect(items.filter((item) => item.kind === "review")).toStrictEqual([]);

    expect(
      items.find((item) => item.kind === "boss")?.scheduledFor?.getTime(),
    ).toBeGreaterThanOrEqual(lastWeek);

    const advice = await readAdvice(goal.id, WEEKDAYS);
    expect(advice.recommendedMinutes ?? advice.maximum?.dailyMinutes ?? 0).toBeGreaterThan(60);
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
