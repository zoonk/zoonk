import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { createGoal } from "./_utils/create-goal-records";
import { createGoals } from "./create-goals";
import { type GoalDraft } from "./goal-contract";

function draft(attrs: Partial<GoalDraft> = {}): GoalDraft {
  return {
    kind: "learn",
    language: "en",
    prompt: "Understand the world",
    title: "Understand the world",
    ...attrs,
  };
}

async function setup() {
  freezeClock();
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });
  const plan = await planFixture({ goalId: goal.id });
  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  mockSession(user.id);
  return { goal, plan, user };
}

async function versions({ plan }: Awaited<ReturnType<typeof setup>>) {
  const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
  return { inputVersion: saved.inputVersion };
}

async function createReplacement(day: Awaited<ReturnType<typeof setup>>, goalDraft = draft()) {
  const result = await createGoals(
    { dailyMinutes: 20, goals: [goalDraft], studyDays: [1, 2, 3, 4, 5], timeZone: "UTC" },
    { replacesGoalId: day.goal.id },
  );

  if (result.status !== "created" || !result.goals[0]) {
    throw new Error(result.status);
  }

  return result.goals[0];
}

describe("new goal plan marks", () => {
  it("marks creation and the real active-goal switch in their owning transactions", async () => {
    const day = await setup();
    const before = await versions(day);
    const created = await createReplacement(day);

    await expect(
      prisma.goal.findUniqueOrThrow({ where: { id: created.id } }),
    ).resolves.toMatchObject({ status: "active", userId: day.user.id });

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: day.user.id } }),
    ).resolves.toMatchObject({ activeGoalId: created.id });

    await expect(versions(day)).resolves.toStrictEqual({ inputVersion: before.inputVersion + 2 });

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: created.id } }),
    ).resolves.toMatchObject({ inputVersion: 1, phases: [] });
  });

  it("retains the active goal for an explanation without publishing a redundant switch", async () => {
    const day = await setup();
    const before = await versions(day);
    const created = await createReplacement(day, draft({ kind: "explain" }));

    expect(created.isActive).toBe(false);

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: day.user.id } }),
    ).resolves.toMatchObject({ activeGoalId: day.goal.id });

    await expect(versions(day)).resolves.toStrictEqual({ inputVersion: before.inputVersion + 1 });

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: created.id } }),
    ).resolves.toMatchObject({ inputVersion: 0 });
  });

  it("a nonowned replacement id cannot bypass a new goal's date boundary", async () => {
    const day = await setup();
    const other = await userFixture();
    const foreign = await goalFixture({ userId: other.id });

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: day.user.id, status: "active" },
    });

    const before = await versions(day);
    const goals = await prisma.goal.findMany({ where: { userId: day.user.id } });

    await expect(
      createGoals(
        { dailyMinutes: 20, goals: [draft({ targetDate: "2000-01-01" })], timeZone: "UTC" },
        { replacesGoalId: foreign.id },
      ),
    ).rejects.toMatchObject({ name: "InputRangeError" });

    await expect(versions(day)).resolves.toStrictEqual(before);

    await expect(prisma.goal.findMany({ where: { userId: day.user.id } })).resolves.toStrictEqual(
      goals,
    );

    await expect(prisma.usageRecord.count({ where: { userId: day.user.id } })).resolves.toBe(0);

    await expect(prisma.plan.count({ where: { goal: { userId: day.user.id } } })).resolves.toBe(1);
  });

  it("an owned replacement may retain the accepted past date", async () => {
    const day = await setup();

    await prisma.goal.update({
      data: { targetDate: new Date("2000-01-01T00:00:00Z") },
      where: { id: day.goal.id },
    });

    const created = await createReplacement(day, draft({ targetDate: "2000-01-01" }));
    expect(created.targetDate).toBe("2000-01-01");
  });

  it("a real creation constraint failure rolls back the early marker", async () => {
    const day = await setup();
    const before = await versions(day);
    // Reusing this test-owned id produces the actual uniqueness failure, not a persistence mock.
    await expect(
      createGoal({
        dailyMinutes: 20,
        draft: draft(),
        id: day.goal.id,
        input: { dailyMinutes: 20, goals: [draft()], timeZone: "UTC" },
        testedLanguage: null,
        userId: day.user.id,
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    await expect(versions(day)).resolves.toStrictEqual(before);

    await expect(
      prisma.goal.findUniqueOrThrow({ where: { id: day.goal.id } }),
    ).resolves.toStrictEqual(day.goal);
  });
});
