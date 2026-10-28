import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { mockSession } from "../../_test-utils/mock-session";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { answerPlacementQuestion } from "./answer-placement-question";
import { getGoalPlacement } from "./get-goal-placement";

async function setup() {
  const user = await userFixture();
  const fixture = await learnerGoalFixture({ phases: [4, 4], userId: user.id });
  mockSession(user.id);
  return { ...fixture, user };
}

async function answer({
  goalId,
  itemId,
  durationMs = 5000,
  timeZone = "UTC",
}: {
  goalId: string;
  itemId: string;
  durationMs?: number;
  timeZone?: string;
}) {
  return answerPlacementQuestion({
    goalId,
    input: { answer: { selectedIndex: 0 }, durationMs, itemId, timeZone },
  });
}

async function previousAnswers({
  count,
  durationMs,
  item,
  userId,
}: {
  count: number;
  durationMs: number;
  item: { id: string; skillId: string };
  userId: string;
}) {
  await Promise.all(
    Array.from({ length: count }, () =>
      attemptFixture({ durationMs, itemId: item.id, skillId: item.skillId, userId }),
    ),
  );
}

async function ownMaterialFixture({ topics, ready }: { topics: number; ready: number }) {
  const user = await userFixture();
  const fixture = await learnerGoalFixture({ itemsPerSkill: 0, phases: [topics], userId: user.id });
  const blueprint = await examBlueprintFixture({ ownerId: user.id });

  const [items] = await Promise.all([
    Promise.all(
      fixture.skills
        .slice(0, ready)
        .map((skill) =>
          itemFixture({
            content: choiceItemContent(),
            examBlueprintId: blueprint.id,
            skillId: skill.id,
          }),
        ),
    ),
    prisma.goal.update({
      data: { examBlueprintId: blueprint.id, kind: "exam" },
      where: { id: fixture.goal.id },
    }),
    prisma.plan.update({
      data: {
        generatedAt: new Date(),
        graph: {
          phases: [{ milestone: null, name: "Material" }],
          skills: fixture.skills.map((skill) => ({
            area: "Biology",
            lessons: 1,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: null,
          })),
        },
      },
      where: { id: fixture.plan.id },
    }),
  ]);

  mockSession(user.id);
  return { ...fixture, blueprint, items, user };
}

describe("placement's day budget", () => {
  beforeEach(() => {
    freezeClock();
    vi.setSystemTime(new Date("2030-01-02T12:00:00Z"));
  });

  it("starts at zero before any answers", async () => {
    const { goal } = await setup();

    await expect(getGoalPlacement({ goalId: goal.id, timeZone: "UTC" })).resolves.toMatchObject({
      placement: {
        dayBudgetSpent: 0,
        dayBudgetUsed: false,
        next: expect.anything(),
        status: "asking",
      },
      status: "ready",
    });
  });

  it.each([
    { durationMs: 5000, spent: 1 / 12 },
    { durationMs: 40_000, spent: 1 / 6 },
  ])(
    "reports the further along fraction after a $durationMs ms answer",
    async ({ durationMs, spent }) => {
      const { goal, items } = await setup();

      const result = await answer({ durationMs, goalId: goal.id, itemId: items[0]?.id ?? "" });

      expect(result).toMatchObject({
        placement: {
          dayBudgetSpent: spent,
          dayBudgetUsed: false,
          next: expect.anything(),
          status: "asking",
        },
        status: "ready",
      });

      await expect(getGoalPlacement({ goalId: goal.id, timeZone: "UTC" })).resolves.toMatchObject({
        placement: { dayBudgetSpent: spent, dayBudgetUsed: false },
        status: "ready",
      });
    },
  );

  it.each([
    { count: 11, durationMs: 1000, limit: "answer count", spent: 11 / 12 },
    { count: 3, durationMs: 60_000, limit: "answering time", spent: 3 / 4 },
  ])("stops exactly at the $limit cap", async ({ count, durationMs, spent }) => {
    const { goal, items, user } = await setup();
    const item = items[0]!;
    await previousAnswers({ count, durationMs, item, userId: user.id });

    await expect(getGoalPlacement({ goalId: goal.id, timeZone: "UTC" })).resolves.toMatchObject({
      placement: {
        complete: false,
        dayBudgetSpent: spent,
        dayBudgetUsed: false,
        next: expect.anything(),
      },
      status: "ready",
    });

    await expect(answer({ durationMs, goalId: goal.id, itemId: item.id })).resolves.toMatchObject({
      placement: {
        complete: false,
        dayBudgetSpent: 1,
        dayBudgetUsed: true,
        next: null,
        status: "done",
      },
      status: "ready",
    });

    await expect(getGoalPlacement({ goalId: goal.id, timeZone: "UTC" })).resolves.toMatchObject({
      placement: { dayBudgetSpent: 1, dayBudgetUsed: true, next: null, status: "done" },
      status: "ready",
    });
  });

  it.each([
    { count: 11, durationMs: 5000, finalDurationMs: 5000, remainingCount: 1, spent: 12 / 14 },
    { count: 5, durationMs: 60_000, finalDurationMs: 20_000, remainingCount: 3, spent: 360 / 560 },
  ])(
    "scales both limits to all 14 own-material topics ($durationMs ms answers)",
    async ({ count, durationMs, finalDurationMs, remainingCount, spent }) => {
      const { goal, items, plan, skills, user } = await ownMaterialFixture({
        ready: 14,
        topics: 14,
      });

      await prisma.planItem.deleteMany({
        where: { planId: plan.id, skillId: { in: skills.slice(1).map((skill) => skill.id) } },
      });

      const item = items[0]!;
      await previousAnswers({ count, durationMs, item, userId: user.id });

      await expect(answer({ durationMs, goalId: goal.id, itemId: item.id })).resolves.toMatchObject(
        {
          placement: {
            complete: false,
            dayBudgetSpent: spent,
            dayBudgetUsed: false,
            next: expect.anything(),
          },
          status: "ready",
        },
      );

      await previousAnswers({ count: remainingCount, durationMs, item, userId: user.id });

      await expect(
        answer({ durationMs: finalDurationMs, goalId: goal.id, itemId: item.id }),
      ).resolves.toMatchObject({
        placement: {
          complete: false,
          dayBudgetSpent: 1,
          dayBudgetUsed: true,
          next: null,
          status: "done",
        },
        status: "ready",
      });
    },
  );

  it("counts today's placement on shared skills from another goal, including before this goal existed", async () => {
    const { goal: otherGoal, items, skills, user } = await setup();
    await answer({ goalId: otherGoal.id, itemId: items[0]?.id ?? "" });
    await answer({ goalId: otherGoal.id, itemId: items[1]?.id ?? "" });
    await answer({ goalId: otherGoal.id, itemId: items.at(-1)?.id ?? "" });

    vi.setSystemTime(Date.now() + 1000);
    const goal = await goalFixture({ createdAt: new Date(), userId: user.id });
    const plan = await planFixture({ goalId: goal.id });

    await Promise.all(
      skills
        .slice(0, 2)
        .map((skill, position) =>
          planItemFixture({ planId: plan.id, position, skillId: skill.id }),
        ),
    );

    await expect(getGoalPlacement({ goalId: goal.id, timeZone: "UTC" })).resolves.toMatchObject({
      placement: { answered: 0, dayBudgetSpent: 2 / 12, dayBudgetUsed: false },
      status: "ready",
    });
  });

  it("resets at learner-local midnight without changing stored attempts", async () => {
    vi.setSystemTime(new Date("2030-01-02T02:59:00Z"));
    const timeZone = "America/Sao_Paulo";
    const { goal, items, user } = await setup();
    const itemId = items[0]?.id ?? "";

    for (const durationMs of [60_000, 60_000, 60_000, 60_000]) {
      // oxlint-disable-next-line no-await-in-loop -- Each answer advances the day's time budget.
      await answer({ durationMs, goalId: goal.id, itemId, timeZone });
    }

    const stored = await prisma.attempt.findMany({
      orderBy: { id: "asc" },
      where: { userId: user.id },
    });

    expect(stored).toHaveLength(4);

    expect(
      stored.every((attempt) => attempt.localDate.toISOString() === "2030-01-01T00:00:00.000Z"),
    ).toBe(true);

    await expect(getGoalPlacement({ goalId: goal.id, timeZone })).resolves.toMatchObject({
      placement: { dayBudgetSpent: 1, dayBudgetUsed: true, next: null },
      status: "ready",
    });

    vi.setSystemTime(new Date("2030-01-02T03:01:00Z"));

    await expect(getGoalPlacement({ goalId: goal.id, timeZone })).resolves.toMatchObject({
      placement: {
        dayBudgetSpent: 0,
        dayBudgetUsed: false,
        next: expect.anything(),
        status: "asking",
      },
      status: "ready",
    });

    await expect(
      prisma.attempt.findMany({ orderBy: { id: "asc" }, where: { userId: user.id } }),
    ).resolves.toStrictEqual(stored);

    await expect(answer({ goalId: goal.id, itemId, timeZone })).resolves.toMatchObject({
      placement: { dayBudgetSpent: 1 / 12, dayBudgetUsed: false },
      status: "ready",
    });
  });

  it("never decreases through a preparation timeout and a delayed batch, or reopens an exhausted day", async () => {
    const { blueprint, goal, items, skills } = await ownMaterialFixture({ ready: 6, topics: 7 });

    for (const item of items) {
      // oxlint-disable-next-line no-await-in-loop -- Each answer updates the learner's placement.
      await answerPlacementQuestion({
        goalId: goal.id,
        input: { answer: { selectedIndex: 0 }, durationMs: 40_000, itemId: item.id },
      });
    }

    const preparing = await getGoalPlacement({ goalId: goal.id });
    vi.setSystemTime(Date.now() + 11 * 60_000);
    const expired = await getGoalPlacement({ goalId: goal.id });

    const delayed = await itemFixture({
      content: choiceItemContent(),
      examBlueprintId: blueprint.id,
      skillId: skills[6]?.id ?? "",
    });

    const arrived = await getGoalPlacement({ goalId: goal.id });

    expect(arrived.status === "ready" && arrived.placement.dayBudgetSpent).toBeGreaterThanOrEqual(
      expired.status === "ready" ? expired.placement.dayBudgetSpent : -1,
    );

    for (const result of [preparing, expired, arrived]) {
      expect(result).toMatchObject({
        placement: { dayBudgetSpent: 6 / 7, dayBudgetUsed: false },
        status: "ready",
      });
    }

    const exhausted = await answerPlacementQuestion({
      goalId: goal.id,
      input: { answer: { selectedIndex: 0 }, durationMs: 40_000, itemId: delayed.id },
    });

    expect(exhausted).toMatchObject({
      placement: {
        complete: false,
        dayBudgetSpent: 1,
        dayBudgetUsed: true,
        next: null,
        status: "done",
      },
      status: "ready",
    });

    await itemFixture({
      content: choiceItemContent(),
      examBlueprintId: blueprint.id,
      skillId: skills[6]?.id ?? "",
    });

    await expect(getGoalPlacement({ goalId: goal.id })).resolves.toMatchObject({
      placement: { dayBudgetSpent: 1, dayBudgetUsed: true, next: null, status: "done" },
      status: "ready",
    });
  });
});
