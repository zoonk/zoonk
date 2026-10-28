import { prisma } from "@zoonk/db";
import { attemptFixture, learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { loadPlanChangeView } from "../plans/_utils/owned-plan";
import { loadTodayPlanChange } from "../plans/_utils/today-plan-change";
import { createGoalPlan } from "../plans/create-goal-plan";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { startStudyBlock } from "../sessions/start-study-block";
import { stopStudySession } from "../sessions/stop-study-session";
import { rebalancePlanAfterSession } from "./rebalance-plan";

/** A Wednesday in 2020, before other tests' learning events, so the planner's pace is its own. */
const NOW = new Date("2020-09-30T12:00:00Z");
const DAY_MS = 86_400_000;

const REMEMBERED = {
  difficulty: 5,
  lastReviewedAt: new Date(NOW.getTime() - DAY_MS),
  stability: 30,
};

const FADING = {
  difficulty: 5,
  lastReviewedAt: new Date(NOW.getTime() - 10 * DAY_MS),
  stability: 1,
};

async function setup({ phases = "shared" }: { phases?: "separate" | "shared" } = {}) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Humanities", "Science"],
    skills: [
      { area: "Humanities", lessons: 2, phase: 0 },
      { area: "Humanities", lessons: 2, phase: 0 },
      { area: "Science", lessons: 2, phase: 1 },
      { area: "Science", lessons: 2, phase: 1 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  const graph =
    phases === "shared"
      ? {
          ...library.graph,
          phases: [{ milestone: null, name: "Foundations" }],
          skills: library.graph.skills.map((skill) => ({ ...skill, phase: 0 })),
        }
      : library.graph;

  await createGoalPlan({ goalId: goal.id, graph });

  const studiedAt = new Date(NOW.getTime() - 2 * DAY_MS);
  const [humanities, science] = [library.skills.slice(0, 2), library.skills.slice(2)];

  await Promise.all([
    ...humanities.map((skill) =>
      learnerSkillFixture({
        ...REMEMBERED,
        createdAt: studiedAt,
        reps: 3,
        skillId: skill.id,
        state: "solid",
        userId: user.id,
      }),
    ),
    ...science.map((skill) =>
      learnerSkillFixture({
        ...FADING,
        createdAt: studiedAt,
        reps: 1,
        skillId: skill.id,
        state: "learning",
        userId: user.id,
      }),
    ),
    ...library.skills.map((skill) =>
      attemptFixture({ answeredAt: studiedAt, skillId: skill.id, userId: user.id }),
    ),
  ]);

  return { goal, plan, user };
}

function rebalances(planId: string) {
  return prisma.planChange.findMany({
    where: { payload: { equals: "preparation", path: ["source"] }, planId },
  });
}

describe(rebalancePlanAfterSession, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves time to the fading area while another goes well, once a week", async () => {
    const { goal, plan, user } = await setup();

    await rebalancePlanAfterSession({ goalId: goal.id, now: NOW, userId: user.id });

    const [change] = await rebalances(plan.id);

    expect(change).toMatchObject({
      payload: { operations: [{ areas: ["Science"], kind: "focusAreas" }] },
      status: "applied",
    });

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(parsePlanSettings(saved.settings).focusAreas).toStrictEqual(["Science"]);

    await rebalancePlanAfterSession({ goalId: goal.id, now: NOW, userId: user.id });
    await expect(rebalances(plan.id)).resolves.toHaveLength(1);

    await expect(loadPlanChangeView(change?.id ?? "")).resolves.toMatchObject({
      canUndo: true,
      operations: [{ areas: ["Science"], kind: "focusAreas" }],
      reason: null,
      source: "preparation",
      status: "applied",
    });

    await expect(loadTodayPlanChange({ goal, now: NOW })).resolves.toBeNull();
  });

  it("announces no move when focusing the fading area wouldn't move anything", async () => {
    const { goal, plan, user } = await setup({ phases: "separate" });

    await rebalancePlanAfterSession({ goalId: goal.id, now: NOW, userId: user.id });

    await expect(rebalances(plan.id)).resolves.toHaveLength(0);
  });

  it("runs when the learner stops for today, since a stopped session may never be finished", async () => {
    const { goal, plan, user } = await setup();
    mockSession(user.id);

    const today = await getTodayStudySession({ goalId: goal.id });

    if (today.status !== "ready") {
      throw new Error("Expected today's session");
    }

    const { blocks, id: sessionId } = today.session;

    await startStudyBlock({ blockId: blocks[0]?.id ?? "", input: {}, sessionId });
    const finishDeferred = runDeferredWork();
    await stopStudySession({ input: {}, sessionId });
    await finishDeferred();

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: sessionId } }),
    ).resolves.toMatchObject({ endedAt: null, status: "active" });

    const [change] = await rebalances(plan.id);

    expect(change).toMatchObject({
      payload: { operations: [{ areas: ["Science"], kind: "focusAreas" }] },
    });
  });

  it("leaves a plan without a graph alone", async () => {
    const user = await userFixture();
    const { goal, plan } = await unplannedGoalFixture({ userId: user.id });

    await rebalancePlanAfterSession({ goalId: goal.id, now: NOW, userId: user.id });
    await expect(rebalances(plan.id)).resolves.toHaveLength(0);
  });
});
