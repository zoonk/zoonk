import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, plannedSkills } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { listOwed } from "../_test-utils/follow-ups";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../_test-utils/learner-lock";
import { mockSession } from "../_test-utils/mock-session";
import { oweFollowUps } from "../follow-ups/owe-follow-ups";
import { getGoalGenerationAccess } from "../lookahead/goal-generation-access";
import { finishGoalRebuild, isGoalRebuildOwed } from "./goal-rebuild-follow-up";

async function savedGoal() {
  const user = await userFixture();
  const skill = await skillFixture();
  const goal = await goalFixture({ generationRunId: "current-run", userId: user.id });

  await planFixture({
    goalId: goal.id,
    graph: { phases: [{ milestone: null, name: "Saved" }], skills: plannedSkills([skill]) },
  });

  mockSession(user.id);
  return { goal, user };
}

describe("a goal rebuild's owed work", () => {
  it("coalesces simultaneous retry taps into the same row and revision", async () => {
    const { goal, user } = await savedGoal();
    const held = holdLearnerLock({ userId: user.id });
    const pid = await held.pid;

    const requests = Promise.all([
      getGoalGenerationAccess({ goalId: goal.id }),
      getGoalGenerationAccess({ goalId: goal.id }),
    ]);

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK, 2);
    } finally {
      held.release();
      await held.done;
    }

    const [first, second] = await requests;
    expect(first).toStrictEqual(second);

    await expect(listOwed(user.id)).resolves.toStrictEqual([
      { input: { goalId: goal.id }, key: goal.id, kind: "rebuildGoalCurriculum" },
    ]);

    await expect(
      prisma.followUp.findFirstOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ revision: 0 });
  });

  it("keeps an existing rebuild ask even before its first graph is saved", async () => {
    const { goal, user } = await savedGoal();
    await prisma.plan.update({ data: { graph: {} }, where: { goalId: goal.id } });

    await oweFollowUps({
      followUps: [{ input: { goalId: goal.id }, kind: "rebuildGoalCurriculum" }],
      userId: user.id,
    });

    const owed = await prisma.followUp.findFirstOrThrow({ where: { userId: user.id } });

    await expect(getGoalGenerationAccess({ goalId: goal.id })).resolves.toMatchObject({
      goal: { followUp: { id: owed.id, revision: owed.revision } },
    });
  });

  it("cannot spend or finish a newer revision using an older ask", async () => {
    const { goal, user } = await savedGoal();
    await getGoalGenerationAccess({ goalId: goal.id });
    const old = await prisma.followUp.findFirstOrThrow({ where: { userId: user.id } });

    await oweFollowUps({
      followUps: [{ input: { goalId: goal.id }, kind: "rebuildGoalCurriculum" }],
      userId: user.id,
    });

    const input = { followUp: { id: old.id, revision: old.revision }, goalId: goal.id };
    await expect(isGoalRebuildOwed(input)).resolves.toBe(false);
    await finishGoalRebuild({ ...input, failed: true, generationId: "current-run" });

    await expect(
      prisma.followUp.findUniqueOrThrow({ where: { id: old.id } }),
    ).resolves.toMatchObject({ revision: 1 });

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
    ).resolves.toMatchObject({ buildFailedAt: null });
  });

  it("records terminal failure and ends its row together without failing a newer run", async () => {
    const { goal, user } = await savedGoal();
    await getGoalGenerationAccess({ goalId: goal.id });
    const owed = await prisma.followUp.findFirstOrThrow({ where: { userId: user.id } });

    await finishGoalRebuild({
      failed: true,
      followUp: owed,
      generationId: "earlier-run",
      goalId: goal.id,
    });

    await expect(prisma.followUp.count({ where: { userId: user.id } })).resolves.toBe(0);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
    ).resolves.toMatchObject({ buildFailedAt: null });
  });
});
