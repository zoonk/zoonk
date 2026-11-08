import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../cache/tags";
import { oweFollowUps } from "../follow-ups/owe-follow-ups";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { parsePlanGraph } from "../plans/planner/plan-state";

export type GoalRebuildFollowUp = { id: string; revision: number };

/** Internal: the generation admission checked this goal's owner. Repeated starts share one ask. */
export async function requestGoalRebuild(goal: Goal): Promise<GoalRebuildFollowUp | null> {
  if (goal.kind === "explain") {
    return null;
  }

  const result = await writeLearnerChange<GoalRebuildFollowUp | null>(
    { userId: goal.userId },
    async (tx) => {
      const current = await tx.goal.findUnique({ include: { plan: true }, where: { id: goal.id } });

      const where = {
        userKindKey: { key: goal.id, kind: "rebuildGoalCurriculum" as const, userId: goal.userId },
      };

      const owed = await tx.followUp.findUnique({ where });

      if (owed) {
        return unchanged({ id: owed.id, revision: owed.revision });
      }

      if (!current || parsePlanGraph(current.plan?.graph).skills.length === 0) {
        return unchanged(null);
      }

      await oweFollowUps({
        db: tx,
        followUps: [{ input: { goalId: goal.id }, kind: "rebuildGoalCurriculum" }],
        userId: goal.userId,
      });

      const created = await tx.followUp.findUniqueOrThrow({ where });
      return { id: created.id, revision: created.revision };
    },
  );

  if (result) {
    revalidateCacheTags([getGoalsCacheTag(goal.userId), getLearnerModelCacheTag(goal.userId)]);
  }

  return result;
}

export async function isGoalRebuildOwed({
  followUp,
  goalId,
}: {
  followUp: GoalRebuildFollowUp;
  goalId: string;
}): Promise<boolean> {
  return (
    (await prisma.followUp.count({
      where: {
        id: followUp.id,
        key: goalId,
        kind: "rebuildGoalCurriculum",
        revision: followUp.revision,
      },
    })) > 0
  );
}

/** Internal workflow bridge: terminal cleanup is guarded by the ask's exact revision and run. */
export async function finishGoalRebuild({
  failed,
  followUp,
  generationId,
  goalId,
}: {
  failed: boolean;
  followUp: GoalRebuildFollowUp;
  generationId: string;
  goalId: string;
}): Promise<void> {
  const [row, plan] = await Promise.all([
    prisma.followUp.findUnique({ where: { id: followUp.id } }),
    prisma.plan.findUnique({ select: { id: true }, where: { goalId } }),
  ]);

  if (!row || row.kind !== "rebuildGoalCurriculum" || row.key !== goalId) {
    return;
  }

  const changed = await writeLearnerChange(
    { lockPlanIds: plan ? [plan.id] : [], userId: row.userId },
    async (tx) => {
      const current = await tx.followUp.findUnique({ where: { id: row.id } });

      if (current?.revision !== followUp.revision) {
        return unchanged(false);
      }

      if (failed) {
        await tx.plan.updateMany({
          data: { buildFailedAt: new Date() },
          where: { goal: { generationRunId: generationId }, goalId },
        });
      }

      await tx.followUp.deleteMany({ where: { id: row.id, revision: followUp.revision } });
      return true;
    },
  );

  if (changed) {
    revalidateCacheTags([getGoalsCacheTag(row.userId), getLearnerModelCacheTag(row.userId)]);
  }
}
