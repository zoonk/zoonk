import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markPlansChanged } from "../../learner/_utils/mark-learner-changed";
import { keepPaceOwn } from "../_test-utils/keep-pace-own";
import { planLibraryFixture, unplannedGoalFixture } from "../_test-utils/plan-library";
import { createGoalPlan } from "../create-goal-plan";
import { PlanConflictError } from "../plan-conflict";
import { markPlanWrite } from "./mark-plan-write";
import { loadPlanContext } from "./plan-context";
import { readPlanSummary } from "./plan-summary";
import { preparePlanWrite } from "./prepare-plan-write";
import { computePlan } from "./replan";
import { savePlanInputsKey, writePlan } from "./write-plan";

const NOW = new Date("2026-10-12T12:00:00Z");

async function setup() {
  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({ skills: [{ lessons: 4 }, { lessons: 3 }] }),
  ]);

  const { goal } = await unplannedGoalFixture({
    createdAt: NOW,
    dailyMinutes: 20,
    settings: { startDate: "2026-10-12" },
    targetDate: new Date("2026-11-30"),
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  const readPlan = () => prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

  const loadContext = async () => {
    const context = await loadPlanContext({ goal, timeZone: "UTC" });

    if (!context) {
      throw new Error("Expected the plan's context");
    }

    return context;
  };

  return { goal, loadContext, readPlan };
}

describe("plan writes", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    await keepPaceOwn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("posts a summary that describes the plan it saves", async () => {
    const { goal, readPlan } = await setup();
    const plan = await readPlan();

    expect(
      readPlanSummary({
        plan: { id: plan.id, userId: goal.userId, version: plan.version },
        value: plan.summary,
      }),
    ).toMatchObject({ basis: { planVersion: plan.version }, schemaVersion: 3 });
  });

  it("refuses a layout an input writer marked since", async () => {
    const { loadContext } = await setup();
    const context = await loadContext();
    const computed = await computePlan({ context, mode: "automatic" });
    await prisma.$transaction((tx) => markPlansChanged(tx, { planIds: [context.plan.id] }));

    await expect(
      prisma.$transaction(async (tx) => {
        const writeContext = { ...context, plan: await markPlanWrite(tx, context.plan) };

        await writePlan({
          context: writeContext,
          plan: await preparePlanWrite({ computed, context: writeContext }),
          tx,
        });
      }),
    ).rejects.toBeInstanceOf(PlanConflictError);
  });

  it("keeps a run's key on a plan it left as it was, without touching its layout", async () => {
    const { loadContext, readPlan } = await setup();
    const context = await loadContext();
    const before = await readPlan();

    await savePlanInputsKey({ context, graph: context.state.graph, inputsKey: "same-inputs" });

    const after = await readPlan();

    expect(after.inputsKey).toBe("same-inputs");
    expect(after.inputVersion).toBe(before.inputVersion + 1);

    const layout = ({ phases, settings, summary, version }: typeof after) => ({
      phases,
      settings,
      summary,
      version,
    });

    expect(layout(after)).toStrictEqual(layout(before));

    await expect(
      savePlanInputsKey({ context, graph: context.state.graph, inputsKey: "stale-inputs" }),
    ).rejects.toBeInstanceOf(PlanConflictError);

    await expect(readPlan()).resolves.toMatchObject({ inputsKey: "same-inputs" });
  });

  it("keeps a waiting quote's sources among the plan's, and only while it waits", async () => {
    const { loadContext, readPlan } = await setup();
    const { id: planId } = await readPlan();
    const quoted = crypto.randomUUID();

    const change = await prisma.planChange.create({
      data: {
        kind: "edited",
        payload: { quoteSourceSkillIds: [quoted, "not-a-skill-id"] },
        planId,
        reason: "Waiting proposal",
        status: "proposed",
      },
    });

    const layOut = async () => {
      const context = await loadContext();
      const computed = await computePlan({ context, mode: "automatic" });

      await prisma.$transaction(async (tx) => {
        const writeContext = { ...context, plan: await markPlanWrite(tx, context.plan) };

        await writePlan({
          context: writeContext,
          plan: await preparePlanWrite({ computed, context: writeContext }),
          tx,
        });
      });

      const saved = await readPlan();
      return { built: computed.selected.sourceSkillIds, saved: saved.sourceSkillIds };
    };

    const waiting = await layOut();

    expect(waiting.built).not.toContain(quoted);
    expect(waiting.saved).toStrictEqual([...waiting.built, quoted].toSorted());

    await prisma.planChange.update({ data: { status: "declined" }, where: { id: change.id } });
    const answered = await layOut();

    expect(answered.saved).toStrictEqual(answered.built);
  });
});
