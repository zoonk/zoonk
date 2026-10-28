import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { trackServerEvent } from "../analytics/server";
import { keptEndPlanFixture, readPlan } from "../plans/_test-utils/kept-end-plan";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import * as refresh from "../plans/refresh-goal-plan";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { loadCatchUpItems } from "../sessions/_utils/catch-up";
import { updateGoal } from "./update-goal";

/** Before other tests' learning events, so their pace never changes these plans. */
const MONDAY = new Date("2020-09-28T12:00:00Z");

async function signedInGoal() {
  const user = await userFixture();

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  mockSession(user.id);

  return { goal, plan, user };
}

async function setup() {
  const [signedIn, library] = await Promise.all([
    signedInGoal(),
    planLibraryFixture({ skills: [{ lessons: 8 }, { lessons: 6 }] }),
  ]);

  await createGoalPlan({ goalId: signedIn.goal.id, graph: library.graph });

  return signedIn;
}

describe(updateGoal, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("saves combined goal metadata and schedule with one planning commit", async () => {
    const { goal, plan } = await setup();
    const renew = vi.spyOn(refresh, "refreshGoalPlan");

    await expect(
      updateGoal({
        goalId: goal.id,
        input: {
          dailyMinutes: 15,
          details: { placementDeclined: true },
          timeZone: "Pacific/Kiritimati",
        },
      }),
    ).resolves.toMatchObject({ status: "updated" });

    expect(renew).toHaveBeenCalledTimes(0);

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(saved.summary).toMatchObject({
      basis: { layoutStudyDay: "2020-09-29", timeZone: "Pacific/Kiritimati" },
    });
  });

  it("updates plain fields without touching the plan", async () => {
    const { goal, plan } = await setup();
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    const result = await updateGoal({
      goalId: goal.id,
      input: { studyTime: "07:30", title: "Physics" },
    });

    expect(result).toMatchObject({
      change: null,
      goal: { studyTime: "07:30", title: "Physics" },
      status: "updated",
    });

    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: before.inputVersion,
    });
  });

  it("marks the learner's plans changed with a source or calendar change, and not on a no-op", async () => {
    const { goal, plan, user } = await signedInGoal();
    const { plan: otherPlan } = await unplannedGoalFixture({ userId: user.id });
    const input = { details: { placementDeclined: true }, timeZone: "America/Sao_Paulo" };

    await expect(updateGoal({ goalId: goal.id, input })).resolves.toMatchObject({
      status: "updated",
    });

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(saved.inputVersion).toBeGreaterThan(plan.inputVersion);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: otherPlan.id } }),
    ).resolves.toMatchObject({ inputVersion: otherPlan.inputVersion + 1 });

    await expect(updateGoal({ goalId: goal.id, input })).resolves.toMatchObject({
      status: "updated",
    });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: saved.inputVersion,
    });
  });

  it("re-plans when the learner's time or days change, with a change they can undo", async () => {
    const { goal, plan } = await setup();

    const result = await updateGoal({
      goalId: goal.id,
      input: { dailyMinutes: 30, studyDays: [1, 2, 3, 4, 5] },
    });

    expect(result).toMatchObject({
      change: { canUndo: true, kind: "edited", source: "learner" },
      goal: { dailyMinutes: 30, studyDays: [1, 2, 3, 4, 5] },
      status: "updated",
    });

    const stored = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(stored.settings).toMatchObject({ weekdayMinutes: [0, 30, 30, 30, 30, 30, 0] });

    const weekend = await prisma.planItem.count({
      where: {
        planId: plan.id,
        scheduledFor: { in: [new Date("2020-10-03"), new Date("2020-10-04")] },
      },
    });

    expect(weekend).toBe(0);
  });

  it("saves the resulting local-day plan after a timezone-only edit", async () => {
    const { goal, plan } = await setup();
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    await expect(
      updateGoal({ goalId: goal.id, input: { timeZone: "Pacific/Kiritimati" } }),
    ).resolves.toMatchObject({ status: "updated" });

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(saved.version).toBeGreaterThan(before.version);

    expect(saved.summary).toMatchObject({
      basis: { layoutStudyDay: "2020-09-29", timeZone: "Pacific/Kiritimati" },
    });
  });

  it("saves a plan after planner-relevant details change", async () => {
    const { goal, plan } = await setup();
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    await updateGoal({ goalId: goal.id, input: { details: { level: "advanced" } } });
    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(saved.summary).toMatchObject({ basis: { layoutInputVersion: saved.inputVersion } });
    expect(saved.inputsKey).not.toBe(before.inputsKey);
  });

  it("refuses a past target date", async () => {
    const { goal } = await setup();

    await expect(
      updateGoal({ goalId: goal.id, input: { targetDate: "2020-09-01" } }),
    ).resolves.toStrictEqual({ error: "pastDate", status: "invalid" });
  });

  it("pauses and resumes from today, counting the free plan's one active goal", async () => {
    const { goal, plan, user } = await setup();

    await expect(
      updateGoal({ goalId: goal.id, input: { status: "paused" } }),
    ).resolves.toMatchObject({ goal: { status: "paused" } });

    const other = await goalFixture({ userId: user.id });
    const blocked = await updateGoal({ goalId: goal.id, input: { status: "active" } });
    expect(blocked).toMatchObject({ limit: { resource: "activeGoals" }, status: "limitReached" });

    await prisma.goal.update({ data: { status: "paused" }, where: { id: other.id } });
    vi.setSystemTime(new Date("2020-10-06T12:00:00Z"));

    const resumed = await updateGoal({ goalId: goal.id, input: { status: "active" } });

    expect(resumed).toMatchObject({
      change: { kind: "resumed" },
      goal: { status: "active" },
      status: "updated",
    });

    const first = await prisma.planItem.findFirstOrThrow({
      orderBy: { position: "asc" },
      where: { planId: plan.id, status: "todo" },
    });

    expect(first.scheduledFor?.toISOString().slice(0, 10)).toBe("2020-10-06");
  });

  it("keeps the plan as the learner saw it when the pause left nothing behind", async () => {
    const { goal, plan, user } = await keptEndPlanFixture();
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    const shown = await readPlan(plan.id);
    const { version } = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    await updateGoal({ goalId: goal.id, input: { status: "paused" } });
    vi.setSystemTime(new Date(MONDAY.getTime() + 60_000));

    await expect(
      updateGoal({ goalId: goal.id, input: { status: "active" } }),
    ).resolves.toMatchObject({ change: null, goal: { status: "active" }, status: "updated" });

    await expect(readPlan(plan.id)).resolves.toStrictEqual(shown);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      version,
    });
  });

  it("puts the paused days' lessons first without calling the learner behind", async () => {
    const { goal, plan, user } = await keptEndPlanFixture();
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });
    await updateGoal({ goalId: goal.id, input: { status: "paused" } });

    vi.setSystemTime(new Date("2020-10-01T12:00:00Z"));
    await updateGoal({ goalId: goal.id, input: { status: "active" } });
    await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });

    await expect(
      prisma.planChange.count({ where: { kind: "missedDays", planId: plan.id } }),
    ).resolves.toBe(0);

    await expect(loadCatchUpItems(goal.id)).resolves.toStrictEqual([]);
  });

  it("moves the tabs to another active goal when the shown one is archived", async () => {
    const { goal, user } = await signedInGoal();
    const other = await goalFixture({ userId: user.id });

    await updateGoal({ goalId: goal.id, input: { status: "archived" } });

    const profile = await prisma.userLearningProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });

    expect(profile.activeGoalId).toBe(other.id);
  });

  it('sends "Goal Reached" once when the learner completes a goal', async () => {
    const { goal, user } = await signedInGoal();

    await prisma.goal.update({
      data: { createdAt: new Date("2020-09-18T12:00:00Z") },
      where: { id: goal.id },
    });

    const flush = runDeferredWork();
    vi.mocked(trackServerEvent).mockClear();

    await updateGoal({ goalId: goal.id, input: { status: "completed" } });
    await updateGoal({ goalId: goal.id, input: { status: "completed" } });
    await flush();

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        distinctId: user.id,
        name: "Goal Reached",
        properties: { days: 10, goal_id: goal.id },
      }),
    );
  });

  it("hides other learners' goals", async () => {
    const { goal } = await signedInGoal();
    const stranger = await userFixture();
    mockSession(stranger.id);

    await expect(updateGoal({ goalId: goal.id, input: { title: "Mine" } })).resolves.toStrictEqual({
      status: "notFound",
    });
  });
});
