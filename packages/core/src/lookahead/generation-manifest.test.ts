import { prisma } from "@zoonk/db";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { unplannedCheckpointFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { markLearnerChanged, markPlansChanged } from "../learner/_utils/mark-learner-changed";
import {
  WAITING_START,
  outlineSkill,
  waitingGoal,
} from "../library/curriculum/_test-utils/waiting-goals";
import {
  mockDecision,
  mockSearchTerms,
  uniqueWord,
} from "../library/identity/_test-utils/identity-mocks";
import * as plannerLessons from "../plans/_utils/planner-lessons";
import { createGoalPlan } from "../plans/create-goal-plan";
import { PlanConflictError } from "../plans/plan-conflict";
import { buildPlan } from "../plans/planner/build-plan";
import { readGenerationManifest } from "./_utils/generation-manifest";
import { admitPlanLessons, createPlanGenerationManifest } from "./speculative-lessons";

// Count actual planning and changed-target revalidation without replacing either implementation.
vi.mock("../plans/planner/build-plan", { spy: true });
vi.mock("./_utils/generation-manifest", { spy: true });

async function manifestFixture() {
  const user = await userFixture();
  const fixture = await unplannedCheckpointFixture({ userId: user.id });
  mockSession(user.id);
  await createGoalPlan({ goalId: fixture.goal.id, graph: fixture.graph, setup: "steps" });
  const lessonIds = fixture.lessons.map((lesson) => lesson.id);
  const manifest = await createPlanGenerationManifest({ goalId: fixture.goal.id, lessonIds });
  expect(manifest).not.toBeNull();

  if (!manifest) {
    throw new Error("Expected a selected generation manifest");
  }

  vi.mocked(buildPlan).mockClear();
  vi.mocked(readGenerationManifest).mockClear();
  return { ...fixture, lessonIds, manifest, user };
}

/** A goal planned before its skill was outlined, with the lessons that outline then landed. */
async function outlinedWaitingGoal() {
  const skill = await skillFixture();
  const { goal, plan } = await waitingGoal(skill);
  const lessonIds = await outlineSkill(skill);
  return { goal, lessonIds, plan };
}

/**
 * Another run's content write marks the plan (as saving a shared lesson or question does) while
 * the manifest reads the lessons its stand-ins now name: after the manifest's token, before its
 * re-check. Only the order is the test's; the write and the read are real.
 */
function markPlanWhileRead({ every = false, planId }: { every?: boolean; planId: string }) {
  const load = plannerLessons.loadGoalPlannerLessons;
  const spy = vi.spyOn(plannerLessons, "loadGoalPlannerLessons");

  const marked = async (input: Parameters<typeof load>[0]) => {
    await prisma.$transaction((tx) => markPlansChanged(tx, { planIds: [planId] }));
    return load(input);
  };

  return every ? spy.mockImplementation(marked) : spy.mockImplementationOnce(marked);
}

describe("parent-issued generation manifests", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(WAITING_START);
    mockSearchTerms([uniqueWord()]);
    mockDecision(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("admits a current child batch in one physical statement and no builder entries", async () => {
    const { goal, lessonIds, manifest } = await manifestFixture();

    const read = await countDatabaseStatements(() =>
      admitPlanLessons({ goalId: goal.id, lessonIds, manifest }),
    );

    expect(read.result).toStrictEqual(lessonIds);
    expect(read.statements).toBe(1);
    expect(read.writes).toBe(0);
    expect(buildPlan).not.toHaveBeenCalled();
    expect(readGenerationManifest).not.toHaveBeenCalled();
  });

  it("revalidates only the target whose content version changed", async () => {
    const { goal, lessonIds, manifest } = await manifestFixture();
    const changed = lessonIds[0]!;
    vi.setSystemTime(new Date(WAITING_START.getTime() + 1000));

    await prisma.lesson.update({
      data: { description: "A revised outline" },
      where: { id: changed },
    });

    await expect(admitPlanLessons({ goalId: goal.id, lessonIds, manifest })).resolves.toStrictEqual(
      lessonIds,
    );

    expect(readGenerationManifest).toHaveBeenCalledExactlyOnceWith({
      goalId: goal.id,
      lessonIds: [changed],
    });

    expect(buildPlan).not.toHaveBeenCalled();
  });

  it("a moved input epoch revalidates the queued targets without planning", async () => {
    const { goal, lessonIds, manifest, user } = await manifestFixture();

    await prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { planInputs: true, userId: user.id });
      await tx.goal.update({ data: { dailyMinutes: 18 }, where: { id: goal.id } });
    });

    await expect(
      admitPlanLessons({ goalId: goal.id, lessonIds: lessonIds.slice(0, 1), manifest }),
    ).resolves.toStrictEqual(lessonIds.slice(0, 1));

    expect(readGenerationManifest).toHaveBeenCalledExactlyOnceWith({
      goalId: goal.id,
      lessonIds: lessonIds.slice(0, 1),
    });

    expect(buildPlan).not.toHaveBeenCalled();
  });

  it("rejects a source placement settled after the manifest was issued", async () => {
    const { goal, lessonIds, manifest, plan } = await manifestFixture();
    const settled = lessonIds[0]!;

    await prisma.planItem.updateMany({
      data: { status: "testedOut" },
      where: { lessonId: settled, planId: plan.id },
    });

    await expect(admitPlanLessons({ goalId: goal.id, lessonIds, manifest })).resolves.toStrictEqual(
      lessonIds.slice(1),
    );

    expect(buildPlan).not.toHaveBeenCalled();
  });

  it("admits newly outlined lessons until placement settles their saved stand-in", async () => {
    const { goal, lessonIds, plan } = await outlinedWaitingGoal();
    const saved = await prisma.planItem.findMany({ where: { kind: "lesson", planId: plan.id } });
    expect(saved.every((item) => item.lessonId === null)).toBe(true);
    vi.mocked(buildPlan).mockClear();

    const manifest = await createPlanGenerationManifest({ goalId: goal.id, lessonIds });
    expect(manifest?.targets.map((target) => target.lessonId)).toStrictEqual(lessonIds);

    await expect(admitPlanLessons({ goalId: goal.id, lessonIds, manifest })).resolves.toStrictEqual(
      lessonIds,
    );

    await prisma.planItem.updateMany({
      data: { status: "testedOut" },
      where: { lessonId: null, planId: plan.id },
    });

    await expect(admitPlanLessons({ goalId: goal.id, lessonIds, manifest })).resolves.toStrictEqual(
      [],
    );

    expect(buildPlan).not.toHaveBeenCalled();
  });

  it("issues the manifest from a fresh read when a content write marks the plan while it's read", async () => {
    const { goal, lessonIds, plan } = await outlinedWaitingGoal();
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const reads = markPlanWhileRead({ planId: plan.id });

    const manifest = await createPlanGenerationManifest({ goalId: goal.id, lessonIds });
    const current = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(current.inputVersion).toBeGreaterThan(before.inputVersion);

    expect(manifest?.basis).toMatchObject({
      inputVersion: current.inputVersion,
      planVersion: current.version,
    });

    expect(manifest?.targets.map((target) => target.lessonId)).toStrictEqual(lessonIds);
    expect(reads).toHaveBeenCalledTimes(2);
  });

  it("still refuses a plan whose inputs keep changing on the second read", async () => {
    const { goal, lessonIds, plan } = await outlinedWaitingGoal();
    const reads = markPlanWhileRead({ every: true, planId: plan.id });

    await expect(createPlanGenerationManifest({ goalId: goal.id, lessonIds })).rejects.toThrow(
      PlanConflictError,
    );

    expect(reads).toHaveBeenCalledTimes(2);
  });

  it("lets a failure other than a plan conflict through without reading again", async () => {
    const { goal, lessonIds } = await outlinedWaitingGoal();
    const failure = new Error("The Library is unavailable");

    // A read failing mid-manifest can't be produced safely with the real database: any error other
    // than a plan conflict stands in for it.
    const reads = vi.spyOn(plannerLessons, "loadGoalPlannerLessons").mockRejectedValueOnce(failure);

    await expect(createPlanGenerationManifest({ goalId: goal.id, lessonIds })).rejects.toBe(
      failure,
    );

    expect(reads).toHaveBeenCalledOnce();
  });

  it("requires the parent's manifest for the same goal and an admitted target", async () => {
    const { goal, lessonIds, manifest } = await manifestFixture();
    const other = await userFixture();

    await expect(
      admitPlanLessons({ goalId: goal.id, lessonIds, manifest: null }),
    ).resolves.toStrictEqual([]);

    await expect(
      admitPlanLessons({ goalId: other.id, lessonIds, manifest }),
    ).resolves.toStrictEqual([]);

    await expect(
      admitPlanLessons({ goalId: goal.id, lessonIds: [other.id], manifest }),
    ).resolves.toStrictEqual([]);

    expect(readGenerationManifest).not.toHaveBeenCalled();
    expect(buildPlan).not.toHaveBeenCalled();
  });
});
