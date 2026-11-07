import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { skillFixture, skillPrerequisiteFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listOwed } from "../_test-utils/follow-ups";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import * as replan from "./_utils/replan";
import { changeGoalPlan } from "./change-goal-plan";
import { changeOwnLevel } from "./change-own-level";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { proposePlanChange } from "./propose-plan-change";

const NOW = new Date("2020-09-28T12:00:00Z");

async function setup() {
  const user = await userFixture();
  const library = await planLibraryFixture({ skills: [{ lessons: 8 }, { lessons: 6 }] });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    details: { level: "intermediate" },
    settings: { startDate: "2020-09-28" },
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);
  await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });

  return { goal, library, plan, user };
}

async function proposeShorterDays() {
  const fixture = await setup();

  const proposal = await proposePlanChange({
    goalId: fixture.goal.id,
    operations: [{ kind: "setDailyMinutes", minutes: 5 }],
    reason: "Shorter days.",
    source: "memory",
  });

  if (!("changeId" in proposal)) {
    throw new Error(`Expected a waiting proposal, received ${proposal.status}`);
  }

  return { ...fixture, changeId: proposal.changeId };
}

async function forgetOwedLessons({ planId, userId }: { planId: string; userId: string }) {
  await prisma.followUp.deleteMany({ where: { userId } });
  await prisma.plan.update({ data: { lessonsAskedAt: null }, where: { id: planId } });
}

/** A request that dies after its write commits can't be produced with the real dependencies. */
function dieAfterCommit() {
  vi.spyOn(replan, "revalidatePlanTags").mockImplementationOnce(() => {
    throw new Error("request died after the commit");
  });
}

async function expectOwedLessons({ goalId, userId }: { goalId: string; userId: string }) {
  await expect(listOwed(userId)).resolves.toStrictEqual([
    { input: { goalId, lessonsAskedAt: NOW.getTime() }, key: goalId, kind: "prepareGoalLessons" },
  ]);

  await expect(prisma.plan.findUniqueOrThrow({ where: { goalId } })).resolves.toMatchObject({
    lessonsAskedAt: NOW,
  });
}

describe("a plan change owes its lessons in the transaction that saves it", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("applying a proposal still owes them when the request dies after the commit", async () => {
    const { changeId, goal, plan, user } = await proposeShorterDays();

    await forgetOwedLessons({ planId: plan.id, userId: user.id });
    dieAfterCommit();

    await expect(
      decidePlanChange({
        changeId,
        goalId: goal.id,
        input: { status: "applied", timeZone: "UTC" },
      }),
    ).rejects.toThrow("request died after the commit");

    await expect(
      prisma.planChange.findUniqueOrThrow({ where: { id: changeId } }),
    ).resolves.toMatchObject({ status: "applied" });

    await expectOwedLessons({ goalId: goal.id, userId: user.id });
  });

  it("undoing a change still owes them when the request dies after the commit", async () => {
    const { changeId, goal, plan, user } = await proposeShorterDays();

    await decidePlanChange({
      changeId,
      goalId: goal.id,
      input: { status: "applied", timeZone: "UTC" },
    });

    await forgetOwedLessons({ planId: plan.id, userId: user.id });
    dieAfterCommit();

    await expect(
      decidePlanChange({ changeId, goalId: goal.id, input: { status: "undone", timeZone: "UTC" } }),
    ).rejects.toThrow("request died after the commit");

    await expect(
      prisma.planChange.findUniqueOrThrow({ where: { id: changeId } }),
    ).resolves.toMatchObject({ status: "proposed" });

    await expectOwedLessons({ goalId: goal.id, userId: user.id });
  });

  it("a learner's own change still owes them when the request dies after the commit", async () => {
    const { goal, plan, user } = await setup();

    await forgetOwedLessons({ planId: plan.id, userId: user.id });
    dieAfterCommit();

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ kind: "setDailyMinutes", minutes: 5 }], timeZone: "UTC" },
      }),
    ).rejects.toThrow("request died after the commit");

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      dailyMinutes: 5,
    });

    await expectOwedLessons({ goalId: goal.id, userId: user.id });
  });

  it("lowering their own level still owes them when the request dies after the commit", async () => {
    const { goal, library, plan, user } = await setup();
    const foundation = await skillFixture({ name: `Counting ${randomUUID()}` });

    await skillPrerequisiteFixture({
      prerequisiteId: foundation.id,
      skillId: library.skills[0]?.id ?? "",
    });

    await forgetOwedLessons({ planId: plan.id, userId: user.id });
    dieAfterCommit();

    await expect(
      changeOwnLevel({ goalId: goal.id, input: { level: "basic", timeZone: "UTC" } }),
    ).rejects.toThrow("request died after the commit");

    await expect(
      prisma.planItem.findFirst({ where: { planId: plan.id, skillId: foundation.id } }),
    ).resolves.not.toBeNull();

    await expectOwedLessons({ goalId: goal.id, userId: user.id });
  });
});
