import { prisma } from "@zoonk/db";
import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { memoryInsightFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { respondToMemoryInsight } from "../memory/insights/respond-to-memory-insight";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { seenInsightQuote, seenQuote } from "./_test-utils/seen-quote";
import { parsePlanChangePayload, toPlanChangePayload } from "./_utils/plan-change-payload";
import { loadTodayPlanChange } from "./_utils/today-plan-change";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { PHASE_DATES_SOURCE } from "./plan-change-contract";
import { type PlanChangeQuote } from "./plan-decision-contract";
import { proposePlanChange } from "./propose-plan-change";

/** A Monday in 2020, before the learning events other tests write, which estimates read. */
const NOW = new Date("2020-09-28T12:00:00Z");

const TARGET = new Date("2020-12-31T00:00:00Z");

/** A change to a plan this long is bigger than a lesson, so it waits for the learner's answer. */
const LONG = { phases: ["Basics"], skills: [{ area: "Math", lessons: 14 }] };

const TWO_PHASES = {
  phases: ["Basics", "Projects"],
  skills: [
    { area: "Math", lessons: 4, phase: 0 },
    { area: "Math", lessons: 4, phase: 1 },
  ],
};

async function setup({
  library: shape,
  targetDate,
}: {
  library: typeof LONG | typeof TWO_PHASES;
  targetDate: Date | null;
}) {
  const user = await userFixture();
  const library = await planLibraryFixture(shape);

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    targetDate,
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, plan };
}

async function proposeLongerDays(goalId: string) {
  const proposal = await proposePlanChange({
    goalId,
    operations: [{ kind: "setDailyMinutes", minutes: 30 }],
    reason: "Longer days, so the plan ends sooner.",
    source: "memory",
  });

  return "changeId" in proposal ? proposal.changeId : "";
}

/** As a proposal priced on an earlier study day: its basis is no longer today's. */
async function ageProposal(changeId: string, effect?: { lessonsAdded: number }) {
  const change = await prisma.planChange.findUniqueOrThrow({ where: { id: changeId } });
  const payload = parsePlanChangePayload(change.payload);

  await prisma.planChange.update({
    data: {
      payload: toPlanChangePayload({
        ...payload,
        effect: payload.effect && { ...payload.effect, ...effect },
        previewBasis: payload.previewBasis && { ...payload.previewBasis, studyDay: "2020-09-27" },
      }),
    },
    where: { id: changeId },
  });

  return payload.effect;
}

/** Accepts as an app showing `quote`, by default the one it holds right now. */
async function accept(goalId: string, changeId: string, quote?: PlanChangeQuote | null) {
  return decidePlanChange({
    changeId,
    goalId,
    input: { quote: quote === undefined ? await seenQuote(changeId) : quote, status: "applied" },
  });
}

async function readDailyMinutes(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return goal.dailyMinutes;
}

describe("a suggestion answered on a later day than it was priced", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("can still be accepted on Today, and applies when today's numbers are the ones it showed", async () => {
    const { goal } = await setup({ library: LONG, targetDate: null });
    const changeId = await proposeLongerDays(goal.id);
    await ageProposal(changeId);

    await expect(loadTodayPlanChange({ goal, now: NOW, timeZone: "UTC" })).resolves.toMatchObject({
      canApply: true,
      id: changeId,
    });

    await expect(accept(goal.id, changeId)).resolves.toMatchObject({
      change: { status: "applied" },
      status: "updated",
    });

    await expect(readDailyMinutes(goal.id)).resolves.toBe(30);
  });

  it("applies nothing when today's numbers differ, shows them, and applies on the next answer", async () => {
    const { goal } = await setup({ library: LONG, targetDate: null });
    const changeId = await proposeLongerDays(goal.id);
    const priced = await ageProposal(changeId, { lessonsAdded: 999 });

    await expect(accept(goal.id, changeId)).resolves.toMatchObject({
      change: { canApply: true, effect: priced, status: "proposed" },
      status: "updated",
    });

    await expect(readDailyMinutes(goal.id)).resolves.toBe(12);

    await expect(accept(goal.id, changeId)).resolves.toMatchObject({
      change: { status: "applied" },
      status: "updated",
    });

    await expect(readDailyMinutes(goal.id)).resolves.toBe(30);
  });

  it("applies only the numbers the accepting app showed, after another app or a retry got today's", async () => {
    const { goal } = await setup({ library: LONG, targetDate: null });
    const changeId = await proposeLongerDays(goal.id);
    await ageProposal(changeId, { lessonsAdded: 999 });
    const shown = await seenQuote(changeId);

    const first = await accept(goal.id, changeId, shown);
    const today = first.status === "updated" ? first.change.quote : null;

    expect(today).not.toBeNull();
    expect(today).not.toStrictEqual(shown);

    await expect(accept(goal.id, changeId, shown)).resolves.toMatchObject({
      change: { quote: today, status: "proposed" },
      status: "updated",
    });

    await expect(accept(goal.id, changeId, shown)).resolves.toMatchObject({
      change: { quote: today, status: "proposed" },
      status: "updated",
    });

    await expect(readDailyMinutes(goal.id)).resolves.toBe(12);

    await expect(accept(goal.id, changeId, today)).resolves.toMatchObject({
      change: { status: "applied" },
      status: "updated",
    });

    await expect(readDailyMinutes(goal.id)).resolves.toBe(30);
  });

  it("applies nothing for a quote other than the change's, even when its numbers are today's", async () => {
    const { goal } = await setup({ library: LONG, targetDate: null });
    const changeId = await proposeLongerDays(goal.id);
    const quote = await seenQuote(changeId);

    await expect(
      accept(goal.id, changeId, quote && { ...quote, studyDay: "2020-09-27" }),
    ).resolves.toMatchObject({ change: { quote, status: "proposed" }, status: "updated" });

    await expect(accept(goal.id, changeId, null)).resolves.toMatchObject({
      change: { status: "proposed" },
    });

    await expect(readDailyMinutes(goal.id)).resolves.toBe(12);
  });

  it("keeps a noticed pattern waiting when its change's numbers differ, and accepts it on the next answer", async () => {
    const { goal } = await setup({ library: LONG, targetDate: null });
    const changeId = await proposeLongerDays(goal.id);
    const priced = await ageProposal(changeId, { lessonsAdded: 999 });

    const insight = await memoryInsightFixture({
      goalId: goal.id,
      kind: "planChange",
      payload: { planChangeId: changeId, planChangeStatus: "proposed" },
      userId: goal.userId,
    });

    const answer = async () =>
      respondToMemoryInsight({
        input: { quote: await seenInsightQuote(insight.id), status: "accepted" },
        insightId: insight.id,
      });

    await expect(answer()).resolves.toMatchObject({
      insight: {
        planChange: { canApply: true, effect: priced, status: "proposed" },
        status: "pending",
      },
      status: "updated",
    });

    await expect(readDailyMinutes(goal.id)).resolves.toBe(12);

    await expect(answer()).resolves.toMatchObject({
      insight: { status: "accepted" },
      status: "updated",
    });

    await expect(readDailyMinutes(goal.id)).resolves.toBe(30);
  });
});

describe("a proposal whose preview no longer changes anything", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("leaves Today once the learner's answer finds nothing to apply", async () => {
    const { goal, plan } = await setup({ library: TWO_PHASES, targetDate: TARGET });

    await planChangeFixture({
      createdAt: new Date(NOW.getTime() - 60 * 60 * 1000),
      kind: "missedDays",
      payload: {
        behind: {
          canFocus: false,
          coveredAfter: 0.8,
          coveredBefore: 1,
          currentMinutes: 30,
          measure: "goal",
        },
        days: 1,
        source: "system",
      },
      planId: plan.id,
      status: "applied",
    });

    const proposal = await planChangeFixture({
      kind: "edited",
      payload: {
        effect: {
          endDateAfter: "2020-12-31",
          endDateBefore: "2020-12-31",
          lessonsAdded: 1,
          lessonsRemoved: 0,
          phaseEnds: [],
        },
        operations: [{ kind: "fitPhaseDates" }],
        source: PHASE_DATES_SOURCE,
      },
      planId: plan.id,
      reason: "",
      status: "proposed",
    });

    await expect(accept(goal.id, proposal.id)).resolves.toMatchObject({
      change: { canApply: false, effect: null, status: "proposed" },
      status: "updated",
    });

    await expect(
      loadTodayPlanChange({ goal, now: NOW, timeZone: "UTC" }),
    ).resolves.not.toMatchObject({ id: proposal.id });
  });
});
