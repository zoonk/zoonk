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
import {
  finishGoalRebuild,
  isGoalRebuildOwed,
  recordGoalRebuildSaved,
} from "./goal-rebuild-follow-up";

async function savedGoal() {
  const user = await userFixture();
  const skill = await skillFixture();

  const goal = await goalFixture({
    generationRunId: "current-run",
    planRevealedAt: null,
    userId: user.id,
  });

  await planFixture({
    goalId: goal.id,
    graph: { phases: [{ milestone: null, name: "Saved" }], skills: plannedSkills([skill]) },
  });

  mockSession(user.id);
  return { goal, user };
}

describe("a goal rebuild's owed work", () => {
  it.each([false, true])(
    "does not owe a graph for a healthy plan (revealed: %s)",
    async (revealed) => {
      const { goal, user } = await savedGoal();

      await prisma.goal.update({
        data: { planRevealedAt: revealed ? new Date() : null },
        where: { id: goal.id },
      });

      await getGoalGenerationAccess({ goalId: goal.id });
      await expect(listOwed(user.id)).resolves.toStrictEqual([]);
    },
  );

  it("coalesces simultaneous retry taps into the same row and revision", async () => {
    const { goal, user } = await savedGoal();
    await prisma.plan.update({ data: { buildFailedAt: new Date() }, where: { goalId: goal.id } });

    await prisma.followUp.create({
      data: {
        failedAt: new Date(),
        input: { goalId: goal.id },
        key: goal.id,
        kind: "rebuildGoalCurriculum",
        userId: user.id,
      },
    });

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
    ).resolves.toMatchObject({ failedAt: null, revision: 1 });
  });

  it.each(["unsaved", "saved", "revealed"])(
    "keeps only an unsaved, unseen failed graph owed (state: %s)",
    async (state) => {
      const { goal, user } = await savedGoal();

      if (state === "revealed") {
        await prisma.goal.update({ data: { planRevealedAt: new Date() }, where: { id: goal.id } });
      }

      await oweFollowUps({
        followUps: [{ input: { goalId: goal.id }, kind: "rebuildGoalCurriculum" }],
        userId: user.id,
      });

      const owed = await prisma.followUp.findFirstOrThrow({ where: { userId: user.id } });

      if (state === "saved") {
        await recordGoalRebuildSaved({ followUp: owed, goalId: goal.id });
      }

      await finishGoalRebuild({
        failed: true,
        followUp: owed,
        generationId: goal.generationRunId!,
        goalId: goal.id,
      });

      const row = await prisma.followUp.findUnique({ where: { id: owed.id } });
      const failedRow = expect.objectContaining({ failedAt: expect.any(Date) });
      expect(row).toStrictEqual(state === "unsaved" ? failedRow : null);
    },
  );

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

  it("cannot spend, claim a saved graph or finish a newer revision using an older ask", async () => {
    const { goal, user } = await savedGoal();

    await oweFollowUps({
      followUps: [{ input: { goalId: goal.id }, kind: "rebuildGoalCurriculum" }],
      userId: user.id,
    });

    const old = await prisma.followUp.findFirstOrThrow({ where: { userId: user.id } });
    await recordGoalRebuildSaved({ followUp: old, goalId: goal.id });

    await oweFollowUps({
      followUps: [{ input: { goalId: goal.id }, kind: "rebuildGoalCurriculum" }],
      userId: user.id,
    });

    const input = { followUp: { id: old.id, revision: old.revision }, goalId: goal.id };
    await expect(isGoalRebuildOwed(input)).resolves.toBe(false);
    await recordGoalRebuildSaved(input);

    await finishGoalRebuild({ ...input, failed: true, generationId: "current-run" });

    await expect(
      prisma.followUp.findUniqueOrThrow({ where: { id: old.id } }),
    ).resolves.toMatchObject({ input: { goalId: goal.id }, revision: 1 });

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
    ).resolves.toMatchObject({ buildFailedAt: null });
  });

  it("records terminal failure and ends its row together without failing a newer run", async () => {
    const { goal, user } = await savedGoal();

    await oweFollowUps({
      followUps: [{ input: { goalId: goal.id }, kind: "rebuildGoalCurriculum" }],
      userId: user.id,
    });

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
