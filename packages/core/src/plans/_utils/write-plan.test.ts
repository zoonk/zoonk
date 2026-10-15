import { type PlanAdaptationReason, prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markPlansChanged } from "../../learner/_utils/mark-learner-changed";
import { planLibraryFixture, unplannedGoalFixture } from "../_test-utils/plan-library";
import { keepPaceOwn } from "../_test-utils/sim/sim-db-pace";
import { createGoalPlan } from "../create-goal-plan";
import { PlanConflictError } from "../plan-conflict";
import { toComputedPlanWrite } from "./computed-plan-write";
import { markPlanWrite } from "./mark-plan-write";
import { loadPlanContext } from "./plan-context";
import { readPlanSummary } from "./plan-summary";
import { computePlan } from "./replan";
import { acknowledgePlanInputs, writePlan } from "./write-plan";

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

const KEYS = { placement: "placement-key", scope: "scope-key", version: 1 as const };

/** An input writer's marker: the reasons join the plan's, with its input version, as S-B writes them. */
async function addReasons({
  pace,
  planId,
  reasons,
}: {
  pace?: { factor: number; source: "own" };
  planId: string;
  reasons: PlanAdaptationReason[];
}) {
  await prisma.$transaction(async (tx) => {
    await markPlansChanged(tx, { planIds: [planId] });

    await tx.plan.update({
      data: { pendingAdaptation: { push: reasons }, ...(pace && { pendingPace: pace }) },
      where: { id: planId },
    });
  });
}

describe("plan writes and pending adaptation", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    await keepPaceOwn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("posts a summary that describes the plan it saves, checked against its inputs", async () => {
    const { goal, readPlan } = await setup();
    const plan = await readPlan();

    expect(
      readPlanSummary({
        plan: { id: plan.id, userId: goal.userId, version: plan.version },
        value: plan.summary,
      }),
    ).toMatchObject({ basis: { planVersion: plan.version }, schemaVersion: 2 });

    expect(plan.checkedInputVersion).toBe(plan.inputVersion);
    expect(plan.pendingAdaptation).toStrictEqual([]);
  });

  it("clears only the reasons a layout took in, and the pace waiting with `pace`", async () => {
    const { loadContext, readPlan } = await setup();
    const { id: planId } = await readPlan();

    await addReasons({
      pace: { factor: 1.3, source: "own" },
      planId,
      reasons: ["evidence", "pace", "content"],
    });

    const context = await loadContext();
    const computed = await computePlan({ context, mode: "automatic" });

    await prisma.$transaction(async (tx) => {
      const writeContext = { ...context, plan: await markPlanWrite(tx, context.plan) };

      await writePlan({
        context: writeContext,
        plan: {
          ...toComputedPlanWrite({ computed, context: writeContext, layoutKeys: KEYS }),
          absorbedAdaptation: ["pace", "content"],
        },
        tx,
      });
    });

    const after = await readPlan();

    expect(after.pendingAdaptation).toStrictEqual(["evidence"]);
    expect(after.pendingPace).toBeNull();
    expect(after.layoutKeys).toStrictEqual(KEYS);
    expect(after.checkedInputVersion).toBe(after.inputVersion);
    expect(after.version).toBe(context.plan.version + 1);
  });

  it("refuses a layout an input writer marked since, and keeps that writer's reason", async () => {
    const { loadContext, readPlan } = await setup();
    const context = await loadContext();
    const computed = await computePlan({ context, mode: "automatic" });
    await addReasons({ planId: context.plan.id, reasons: ["content"] });

    await expect(
      prisma.$transaction(async (tx) => {
        const writeContext = { ...context, plan: await markPlanWrite(tx, context.plan) };

        await writePlan({
          context: writeContext,
          plan: {
            ...toComputedPlanWrite({ computed, context: writeContext }),
            absorbedAdaptation: ["content"],
          },
          tx,
        });
      }),
    ).rejects.toBeInstanceOf(PlanConflictError);

    await expect(readPlan()).resolves.toMatchObject({ pendingAdaptation: ["content"] });
  });

  it("acknowledges unchanged inputs without touching the layout, clearing only checked reasons", async () => {
    const { loadContext, readPlan } = await setup();
    const { id: planId } = await readPlan();
    await addReasons({ planId, reasons: ["evidence", "rebalance"] });
    const marked = await readPlan();
    const context = await loadContext();

    await prisma.$transaction(async (tx) => {
      const plan = await markPlanWrite(tx, context.plan);
      await acknowledgePlanInputs(tx, { checkedAdaptation: ["evidence"], layoutKeys: KEYS, plan });
    });

    const after = await readPlan();

    expect(after.pendingAdaptation).toStrictEqual(["rebalance"]);
    expect(after.inputVersion).toBe(marked.inputVersion + 1);
    expect(after.checkedInputVersion).toBe(after.inputVersion);
    expect(after.layoutKeys).toStrictEqual(KEYS);

    // The layout stays byte for byte, at its version.
    const layout = ({ graph, phases, settings, summary, version }: typeof after) => ({
      graph,
      phases,
      settings,
      summary,
      version,
    });

    expect(layout(after)).toStrictEqual(layout(marked));

    // A stamp another write moved since is a conflict, never a silent acknowledgment.
    await expect(
      prisma.$transaction((tx) =>
        acknowledgePlanInputs(tx, { checkedAdaptation: ["rebalance"], plan: context.plan }),
      ),
    ).rejects.toBeInstanceOf(PlanConflictError);

    await expect(readPlan()).resolves.toMatchObject({ pendingAdaptation: ["rebalance"] });
  });

  // A content write finds the plans it changes by their sources: a waiting quote's own sources must
  // be among them, or a write to one would leave the quote's numbers current over stale content.
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
          plan: toComputedPlanWrite({ computed, context: writeContext }),
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
