import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { followPlanToday } from "../plans/_utils/follow-plan-today";
import { loadPlanContext } from "../plans/_utils/plan-context";
import { changeGoalPlan } from "../plans/change-goal-plan";
import { createGoalPlan } from "../plans/create-goal-plan";
import { decidePlanChange } from "../plans/decide-plan-change";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { seedV2PersonaCopy } from "../seed/seed-v2";
import { getTodayStudySession } from "./_test-utils/open-today";
import { startStudyBlock } from "./start-study-block";

/** Sunday after midnight in Maya's time zone, with the weekly challenge due today. */
const NOW = new Date("2026-10-18T04:12:18Z");

/** The Saturday before, late in Maya's evening: a lesson day the plan leaves time on. */
const SATURDAY = new Date("2026-10-18T03:53:18Z");

const REST_WEEKDAY = 2;
const SESSION_INCLUDE = { blocks: { orderBy: { position: "asc" } } } as const;

/** The persona's real planner-built week and an unstarted day opened through the learner's POST. */
async function openPlannedDay(persona: "buddy" | "hugeGoal" = "hugeGoal") {
  const copyKey = crypto.randomUUID();

  const { goalId, userId } = await seedV2PersonaCopy({
    copyKey,
    email: `future-rest-${copyKey}@zoonk.test`,
    persona,
  });

  mockSession(userId);

  const seeded = await prisma.studySession.findFirstOrThrow({
    orderBy: { localDate: "desc" },
    where: { goalId },
  });

  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  const timeZone = goal.timezone ?? "UTC";

  // Only the private copy's hand-built day is removed; the ordinary planner and Open replace it.
  await prisma.studySession.delete({ where: { id: seeded.id } });
  await createGoalPlan({ goalId, graph: parsePlanGraph(plan.graph) });
  const opened = await getTodayStudySession({ goalId, timeZone });

  if (opened.status !== "ready") {
    throw new Error(`Expected the planner-built day, received ${opened.status}`);
  }

  const before = await prisma.studySession.findUniqueOrThrow({
    include: SESSION_INCLUDE,
    where: { id: opened.session.id },
  });

  expect(before.startedAt).toBeNull();
  expect(before.blocks.every((block) => block.status === "pending")).toBe(true);

  return { before, goal, plan, timeZone, userId };
}

/** Sunday's day (`openPlannedDay`), which holds the weekly challenge. */
async function openPlannedSunday(persona: "buddy" | "hugeGoal" = "hugeGoal") {
  const day = await openPlannedDay(persona);
  expect(day.before.blocks.some((block) => block.kind === "checkpoint")).toBe(true);
  return day;
}

/** The learner applies a proposal to rest on `REST_WEEKDAY`s, a day still ahead. */
async function applyFutureRestDay({
  goalId,
  planId,
  timeZone,
}: {
  goalId: string;
  planId: string;
  timeZone: string;
}) {
  const proposal = await planChangeFixture({
    kind: "edited",
    payload: {
      operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [REST_WEEKDAY] }],
      source: "planEdit",
    },
    planId,
    status: "proposed",
  });

  const changed = await decidePlanChange({
    changeId: proposal.id,
    goalId,
    input: { status: "applied", timeZone },
  });

  return { changed, proposal };
}

describe("an unstarted day after a plan change", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps today's blocks and says no session change for a future rest day", async () => {
    const { before, goal, plan, timeZone } = await openPlannedSunday();

    const { changed, proposal } = await applyFutureRestDay({
      goalId: goal.id,
      planId: plan.id,
      timeZone,
    });

    const after = await prisma.studySession.findUniqueOrThrow({
      include: SESSION_INCLUDE,
      where: { id: before.id },
    });

    const savedPlan = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect.soft(after).toStrictEqual({ ...before, planVersion: savedPlan.version });
    expect.soft(changed).toMatchObject({ change: { todaySession: null }, status: "updated" });

    const context = await loadPlanContext({ goal, now: NOW, timeZone });

    if (!context) {
      throw new Error("The learner's applied plan must still exist.");
    }

    const savedChange = await prisma.planChange.findUniqueOrThrow({ where: { id: proposal.id } });

    await followPlanToday({ changeId: proposal.id, context });

    await expect(
      prisma.planChange.findUniqueOrThrow({ where: { id: proposal.id } }),
    ).resolves.toStrictEqual(savedChange);
  });

  it("closes today's unstarted session immediately when the learner closes today", async () => {
    const { before, goal, timeZone } = await openPlannedSunday();

    const changed = await changeGoalPlan({
      goalId: goal.id,
      input: {
        operations: [
          { kind: "setWeekdayMinutes", minutes: 0, weekdays: [before.localDate.getUTCDay()] },
        ],
        timeZone,
      },
    });

    const after = await prisma.studySession.findUniqueOrThrow({
      include: SESSION_INCLUDE,
      where: { id: before.id },
    });

    expect(after.id).toBe(before.id);
    expect(after.blocks).toStrictEqual([]);
    expect(after.plannedMinutes).toBe(0);
    expect(changed).toMatchObject({ change: { todaySession: "changed" }, status: "applied" });
  });

  it("keeps a started day intact and says the change starts on the next study day", async () => {
    const { before, goal, plan, timeZone } = await openPlannedSunday("buddy");
    const first = before.blocks[0];

    expect(before.blocks).toHaveLength(1);

    await startStudyBlock({ blockId: first?.id ?? "", input: { timeZone }, sessionId: before.id });

    const started = await prisma.studySession.findUniqueOrThrow({
      include: SESSION_INCLUDE,
      where: { id: before.id },
    });

    expect(started.blocks[0]?.status).toBe("active");

    const changed = await changeGoalPlan({
      goalId: goal.id,
      input: {
        operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [REST_WEEKDAY] }],
        timeZone,
      },
    });

    const after = await prisma.studySession.findUniqueOrThrow({
      include: SESSION_INCLUDE,
      where: { id: before.id },
    });

    const savedPlan = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(after).toStrictEqual({ ...started, planVersion: savedPlan.version });
    expect(changed).toMatchObject({ change: { todaySession: "unchanged" }, status: "applied" });
  });
});

describe("a started day after a plan change", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SATURDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Maya started Saturday's session and gave Tuesdays a rest from her buddy's card: the rest of
  // her day took five lessons the plan had from November to January, and the card said today's
  // session followed the change. The rest of a started day takes what the plan gives today, as Open
  // does, never the next lessons ahead.
  it("keeps the rest of the day for a future rest day, without lessons from later days", async () => {
    const { before, goal, plan, timeZone } = await openPlannedDay();
    const first = before.blocks[0];

    expect(before.blocks.length).toBeGreaterThan(1);
    expect(before.plannedMinutes).toBeLessThan(goal.dailyMinutes);

    await startStudyBlock({ blockId: first?.id ?? "", input: { timeZone }, sessionId: before.id });

    const started = await prisma.studySession.findUniqueOrThrow({
      include: SESSION_INCLUDE,
      where: { id: before.id },
    });

    const { changed } = await applyFutureRestDay({ goalId: goal.id, planId: plan.id, timeZone });

    const after = await prisma.studySession.findUniqueOrThrow({
      include: SESSION_INCLUDE,
      where: { id: before.id },
    });

    const savedPlan = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect.soft(after).toStrictEqual({ ...started, planVersion: savedPlan.version });
    expect.soft(changed).toMatchObject({ change: { todaySession: null }, status: "updated" });
  });
});
