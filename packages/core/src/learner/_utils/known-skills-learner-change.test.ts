import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../../_test-utils/learner-lock";
import { type GoalPlanItem } from "./goal-skill-graph";
import { markPlanItemsTestedOut, markSkillsKnown } from "./known-skills";

const KNOWN_AT = new Date("2020-09-28T12:00:00Z");

async function setup() {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
  const goal = await goalFixture({ userId: user.id });
  // An unfinished plan isolates these writes from the later planner announcement.
  const plan = await planFixture({ goalId: goal.id });
  return { goal, plan, skill, user };
}

async function versions(fixture: Awaited<ReturnType<typeof setup>>) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: fixture.plan.id } });
  return { inputVersion: plan.inputVersion, version: plan.version };
}

function markKnown(fixture: Awaited<ReturnType<typeof setup>>) {
  return markSkillsKnown({
    knownAt: KNOWN_AT,
    skillIds: [fixture.skill.id],
    timeZone: "UTC",
    userId: fixture.user.id,
  });
}

function testOut({
  fixture,
  items = [],
  standIn = false,
}: {
  fixture: Awaited<ReturnType<typeof setup>>;
  items?: GoalPlanItem[];
  standIn?: boolean;
}) {
  return markPlanItemsTestedOut({
    goalId: fixture.goal.id,
    items,
    knownSkillIds: new Set([fixture.skill.id]),
    placedSkills: standIn ? [{ id: fixture.skill.id, phase: 0 }] : [],
    testedOutAt: KNOWN_AT,
    timeZone: "UTC",
  });
}

describe("known skill writes", () => {
  it("marks a new skill once and leaves repeated or empty claims unchanged", async () => {
    const fixture = await setup();
    const before = await versions(fixture);
    await markKnown(fixture);

    const saved = await prisma.learnerSkill.findUniqueOrThrow({
      where: { userSkill: { skillId: fixture.skill.id, userId: fixture.user.id } },
    });

    expect(saved.reps).toBe(1);

    const changed = { ...before, inputVersion: before.inputVersion + 1 };

    await expect(versions(fixture)).resolves.toStrictEqual(changed);
    await markKnown(fixture);

    await markSkillsKnown({
      knownAt: KNOWN_AT,
      skillIds: [],
      timeZone: "UTC",
      userId: fixture.user.id,
    });

    await expect(versions(fixture)).resolves.toStrictEqual(changed);

    await expect(
      prisma.learnerSkill.findUniqueOrThrow({ where: { id: saved.id } }),
    ).resolves.toStrictEqual(saved);
  });

  it("marks an existing New skill and preserves an already reviewed skill", async () => {
    const fixture = await setup();
    const reviewed = await skillFixture();

    const [, memory] = await Promise.all([
      learnerSkillFixture({ skillId: fixture.skill.id, userId: fixture.user.id }),
      learnerSkillFixture({ reps: 4, skillId: reviewed.id, userId: fixture.user.id }),
    ]);

    const before = await versions(fixture);

    await markSkillsKnown({
      knownAt: KNOWN_AT,
      skillIds: [fixture.skill.id, reviewed.id],
      timeZone: "UTC",
      userId: fixture.user.id,
    });

    await expect(versions(fixture)).resolves.toStrictEqual({
      ...before,
      inputVersion: before.inputVersion + 1,
    });

    await expect(
      prisma.learnerSkill.findUniqueOrThrow({ where: { id: memory.id } }),
    ).resolves.toStrictEqual(memory);
  });

  it("takes the marker before skill rows and commits one of two identical claims", async () => {
    const fixture = await setup();

    const memory = await learnerSkillFixture({
      skillId: fixture.skill.id,
      userId: fixture.user.id,
    });

    const before = await versions(fixture);

    const holder = holdLearnerLock({
      beforeCommit: (tx) =>
        tx.$queryRaw`SELECT id FROM learner_skills WHERE id = ${memory.id}::uuid FOR UPDATE`,
      userId: fixture.user.id,
    });

    const pid = await holder.pid;
    const claims = Promise.all([markKnown(fixture), markKnown(fixture)]);

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK);
    } finally {
      holder.release();
      await Promise.all([holder.done, claims]);
    }

    await expect(versions(fixture)).resolves.toStrictEqual({
      ...before,
      inputVersion: before.inputVersion + 1,
    });
  });
});

describe("tested-out plan item writes", () => {
  it("marks the item transition once even when a retry still carries the old item", async () => {
    const fixture = await setup();
    const item = await planItemFixture({ planId: fixture.plan.id, skillId: fixture.skill.id });
    const items = [{ ...item, skillIds: [fixture.skill.id] }];
    const before = await versions(fixture);
    await testOut({ fixture, items });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: item.id } }),
    ).resolves.toMatchObject({ completedAt: KNOWN_AT, status: "testedOut" });

    const changed = { ...before, inputVersion: before.inputVersion + 1 };

    await expect(versions(fixture)).resolves.toStrictEqual(changed);
    await testOut({ fixture, items });
    await expect(versions(fixture)).resolves.toStrictEqual(changed);
  });

  it("takes the marker before item rows and commits one concurrent transition", async () => {
    const fixture = await setup();
    const item = await planItemFixture({ planId: fixture.plan.id, skillId: fixture.skill.id });
    const items = [{ ...item, skillIds: [fixture.skill.id] }];
    const before = await versions(fixture);

    const holder = holdLearnerLock({
      beforeCommit: (tx) =>
        tx.$queryRaw`SELECT id FROM plan_items WHERE id = ${item.id}::uuid FOR UPDATE`,
      userId: fixture.user.id,
    });

    const pid = await holder.pid;
    const transitions = Promise.all([testOut({ fixture, items }), testOut({ fixture, items })]);

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK);
    } finally {
      holder.release();
      await Promise.all([holder.done, transitions]);
    }

    await expect(versions(fixture)).resolves.toStrictEqual({
      ...before,
      inputVersion: before.inputVersion + 1,
    });
  });
});

describe("tested-out stand-in writes", () => {
  it("marks an insertion once and rolls back plan versions for an already planned skill", async () => {
    const fixture = await setup();
    const before = await versions(fixture);
    const result = await testOut({ fixture, standIn: true });
    expect(result.planItemIds).toHaveLength(1);

    await expect(
      prisma.planItem.findMany({ where: { planId: fixture.plan.id } }),
    ).resolves.toMatchObject([
      { completedAt: KNOWN_AT, skillId: fixture.skill.id, status: "testedOut" },
    ]);

    const changed = { inputVersion: before.inputVersion + 1, version: before.version + 1 };

    await expect(versions(fixture)).resolves.toStrictEqual(changed);
    await expect(testOut({ fixture, standIn: true })).resolves.toMatchObject({ planItemIds: [] });
    await expect(versions(fixture)).resolves.toStrictEqual(changed);
  });

  it("does not mark a missing plan", async () => {
    const fixture = await setup();
    await prisma.plan.delete({ where: { id: fixture.plan.id } });
    await expect(testOut({ fixture, standIn: true })).resolves.toMatchObject({ planItemIds: [] });
  });

  it("waits at the marker before moving the plan version and keeps one stand-in in a race", async () => {
    const fixture = await setup();
    const before = await versions(fixture);
    const holder = holdLearnerLock({ userId: fixture.user.id });
    const pid = await holder.pid;

    const insertions = Promise.all([
      testOut({ fixture, standIn: true }),
      testOut({ fixture, standIn: true }),
    ]);

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK);

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { id: fixture.plan.id } }),
      ).resolves.toMatchObject({ version: before.version });
    } finally {
      holder.release();
      await Promise.all([holder.done, insertions]);
    }

    await expect(versions(fixture)).resolves.toStrictEqual({
      inputVersion: before.inputVersion + 1,
      version: before.version + 1,
    });

    await expect(
      prisma.planItem.count({ where: { planId: fixture.plan.id, skillId: fixture.skill.id } }),
    ).resolves.toBe(1);
  });
});
