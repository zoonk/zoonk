import { prisma } from "@zoonk/db";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { unplannedCheckpointFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
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
import { createGoalPlan } from "../plans/create-goal-plan";
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

describe("parent-issued generation manifests", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(WAITING_START);
    mockSearchTerms([uniqueWord()]);
    mockDecision(null);
  });

  afterEach(() => vi.useRealTimers());

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

  it("includes newly outlined lessons while their saved stand-in remains todo", async () => {
    const skill = await skillFixture();
    const { goal, plan } = await waitingGoal(skill);
    const lessonIds = await outlineSkill(skill);
    const saved = await prisma.planItem.findMany({ where: { kind: "lesson", planId: plan.id } });
    expect(saved.every((item) => item.lessonId === null)).toBe(true);
    vi.mocked(buildPlan).mockClear();

    const manifest = await createPlanGenerationManifest({ goalId: goal.id, lessonIds });
    expect(manifest?.targets.map((target) => target.lessonId)).toStrictEqual(lessonIds);

    await expect(admitPlanLessons({ goalId: goal.id, lessonIds, manifest })).resolves.toStrictEqual(
      lessonIds,
    );

    expect(buildPlan).not.toHaveBeenCalled();
  });

  it("does not let another goal or an unadmitted target use a manifest", async () => {
    const { goal, lessonIds, manifest } = await manifestFixture();
    const other = await userFixture();

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
