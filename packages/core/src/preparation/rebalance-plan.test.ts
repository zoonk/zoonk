import { prisma } from "@zoonk/db";
import { attemptFixture, learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { loadTodayPlanChange } from "../plans/_utils/today-plan-change";
import { createGoalPlan } from "../plans/create-goal-plan";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { getTodayStudySession } from "../sessions/get-today-study-session";
import { startStudyBlock } from "../sessions/start-study-block";
import { stopStudySession } from "../sessions/stop-study-session";
import { rebalancePlanAfterSession } from "./rebalance-plan";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** A Wednesday in 2020, before other tests' learning events, so the planner's pace is its own. */
const NOW = new Date("2020-09-30T12:00:00Z");
const DAY_MS = 86_400_000;

/** Well remembered: reviewed yesterday with a month of stability. */
const REMEMBERED = {
  difficulty: 5,
  lastReviewedAt: new Date(NOW.getTime() - DAY_MS),
  stability: 30,
};

/** Fading: last seen ten days ago with a day of stability. */
const FADING = {
  difficulty: 5,
  lastReviewedAt: new Date(NOW.getTime() - 10 * DAY_MS),
  stability: 1,
};

/**
 * A planned goal with two areas studied this week: Humanities is going well (Solid and
 * remembered), Science is fading. Each area is a chapter of the plan and an area of its graph, both
 * in the graph's first phase, so focusing one moves it ahead of the other.
 */
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

  // One phase in the graph, so the plan's order inside it is what a focus changes.
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
    // Studied: the learner answered on every one of them.
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

    // Today carries it the next day, with its undo.
    await expect(loadTodayPlanChange({ goalId: goal.id, now: NOW })).resolves.toMatchObject({
      canUndo: true,
      chapterTitle: null,
      operations: [{ areas: ["Science"], kind: "focusAreas" }],
      reason: null,
      source: "preparation",
      status: "applied",
    });
  });

  it("announces no move when focusing the fading area wouldn't move anything", async () => {
    // Science comes in its own later phase, after the Humanities it builds on, and everything fits.
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
    await stopStudySession({ input: {}, sessionId });

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
