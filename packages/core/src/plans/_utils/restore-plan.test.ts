import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markPlansChanged } from "../../learner/_utils/mark-learner-changed";
import { planLibraryFixture, unplannedGoalFixture } from "../_test-utils/plan-library";
import { keepPaceOwn } from "../_test-utils/sim/sim-db-pace";
import { createGoalPlan } from "../create-goal-plan";
import { markPlanWrite } from "./mark-plan-write";
import { loadPlanContext } from "./plan-context";
import { savePlanSnapshot } from "./plan-snapshot";
import { planSummarySchema, readPlanSummary } from "./plan-summary";
import { loadPlanSnapshot, restorePlan } from "./restore-plan";

const NOW = new Date("2026-10-12T12:00:00Z");
const KEYS = { placement: "placement-key", scope: "scope-key", version: 1 as const };

describe(restorePlan, () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    await keepPaceOwn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("gives back the layout and its keys, keeps what's pending, and isn't checked since", async () => {
    const [user, library] = await Promise.all([
      userFixture(),
      planLibraryFixture({ skills: [{ lessons: 4 }, { lessons: 3 }] }),
    ]);

    const { goal, plan } = await unplannedGoalFixture({
      createdAt: NOW,
      dailyMinutes: 20,
      settings: { startDate: "2026-10-12" },
      targetDate: new Date("2026-11-30"),
      timezone: "UTC",
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    await prisma.plan.update({ data: { layoutKeys: KEYS }, where: { id: plan.id } });

    const loadContext = async () => {
      const context = await loadPlanContext({ goal, timeZone: "UTC" });

      if (!context) {
        throw new Error("Expected the plan's context");
      }

      return context;
    };

    const change = await prisma.planChange.create({
      data: {
        kind: "edited",
        payload: {},
        planId: plan.id,
        reason: "Test change",
        status: "applied",
      },
    });

    const before = await loadContext();

    await prisma.$transaction((tx) =>
      savePlanSnapshot({ changeId: change.id, context: before, tx }),
    );

    // Since the change: a newer layout without keys, the learner finished a lesson, and two input
    // writers marked the plan with what it doesn't reflect yet.
    const lesson = before.items.find((item) => item.kind === "lesson" && item.status === "todo");

    await prisma.$transaction(async (tx) => {
      await markPlansChanged(tx, { planIds: [plan.id] });

      await tx.plan.update({
        data: {
          layoutKeys: { ...KEYS, scope: "newer" },
          pendingAdaptation: { push: ["evidence", "pace"] },
          pendingPace: { factor: 1.4, source: "own" },
          version: { increment: 1 },
        },
        where: { id: plan.id },
      });

      await tx.planItem.update({
        data: { completedAt: NOW, status: "done" },
        where: { id: lesson?.id },
      });
    });

    const snapshot = await loadPlanSnapshot(change.id);
    const context = await loadContext();

    if (!snapshot) {
      throw new Error("Expected the change's snapshot");
    }

    expect(snapshot.layoutKeys).toStrictEqual(KEYS);

    await prisma.$transaction(async (tx) => {
      const writeContext = { ...context, plan: await markPlanWrite(tx, context.plan) };
      await restorePlan({ context: writeContext, items: snapshot.items, snapshot, tx });
    });

    const after = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(after.layoutKeys).toStrictEqual(KEYS);
    expect(after.pendingAdaptation).toStrictEqual(["evidence", "pace"]);
    expect(after.pendingPace).toStrictEqual({ factor: 1.4, source: "own" });
    expect(after.checkedInputVersion).toBeNull();

    expect(
      readPlanSummary({
        plan: { id: plan.id, userId: user.id, version: after.version },
        value: after.summary,
      }),
    ).toMatchObject({ basis: { planVersion: after.version } });

    await expect(
      prisma.planItem.findUniqueOrThrow({ select: { status: true }, where: { id: lesson?.id } }),
    ).resolves.toStrictEqual({ status: "done" });
  });

  // The change took a lesson the plan counted short out of the plan; the learner then finished it
  // through another goal. The undo brings its item back done, and the summary counts it whole.
  it("counts a lesson the undo brings back finished elsewhere as covered", async () => {
    const [user, library] = await Promise.all([
      userFixture(),
      planLibraryFixture({ skills: [{ lessons: 4 }, { lessons: 3 }] }),
    ]);

    const { goal, plan } = await unplannedGoalFixture({
      createdAt: NOW,
      dailyMinutes: 20,
      settings: { startDate: "2026-10-12" },
      targetDate: new Date("2026-11-30"),
      timezone: "UTC",
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });

    const stored = await prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { id: plan.id },
    });

    const short = stored.items.find(
      (item) => item.kind === "lesson" && item.lessonId && item.skillId,
    );

    if (!short?.lessonId || !short.skillId) {
      throw new Error("Expected a written lesson in the plan");
    }

    // The plan as if it counted that lesson none of its time by the date.
    const summary = planSummarySchema.parse(stored.summary);
    const coverage = summary.selected.coverage;

    if (!coverage) {
      throw new Error("Expected a dated plan's coverage");
    }

    await prisma.plan.update({
      data: {
        summary: {
          ...summary,
          selected: {
            ...summary.selected,
            coverage: {
              ...coverage,
              fits: false,
              shortLessons: [
                {
                  countedRaw: 0,
                  lessonId: short.lessonId,
                  requiredRaw: 5,
                  skillIds: [short.skillId],
                },
              ],
              skills: coverage.skills.map((skill) =>
                skill.skillId === short.skillId
                  ? { ...skill, coveredRaw: skill.coveredRaw - 5 }
                  : skill,
              ),
            },
          },
        },
      },
      where: { id: plan.id },
    });

    const loadContext = async () => {
      const context = await loadPlanContext({ goal, timeZone: "UTC" });

      if (!context) {
        throw new Error("Expected the plan's context");
      }

      return context;
    };

    const change = await prisma.planChange.create({
      data: {
        kind: "edited",
        payload: {},
        planId: plan.id,
        reason: "Test change",
        status: "applied",
      },
    });

    await prisma.$transaction(async (tx) =>
      savePlanSnapshot({ changeId: change.id, context: await loadContext(), tx }),
    );

    await prisma.planItem.delete({ where: { id: short.id } });

    await learningEventFixture({
      contentIds: { lessonId: short.lessonId },
      endedAt: new Date("2026-10-12T11:00:00Z"),
      userId: user.id,
    });

    const snapshot = await loadPlanSnapshot(change.id);
    const context = await loadContext();

    if (!snapshot) {
      throw new Error("Expected the change's snapshot");
    }

    await prisma.$transaction(async (tx) => {
      const writeContext = { ...context, plan: await markPlanWrite(tx, context.plan) };
      await restorePlan({ context: writeContext, items: snapshot.items, snapshot, tx });
    });

    const after = await prisma.plan.findUniqueOrThrow({
      include: { items: { where: { id: short.id } } },
      where: { id: plan.id },
    });

    const restored = readPlanSummary({
      plan: { id: plan.id, userId: user.id, version: after.version },
      value: after.summary,
    });

    expect(after.items).toMatchObject([{ status: "done" }]);
    expect(restored?.selected.coverage?.shortLessons).toStrictEqual([]);
    expect(restored?.selected.coverage?.skills).toStrictEqual(coverage.skills);
    expect(after.coveredShare).toBe(restored?.selected.coverage?.coveredShare);
  });
});
