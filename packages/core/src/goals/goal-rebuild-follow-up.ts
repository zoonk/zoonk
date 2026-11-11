import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../cache/tags";
import { oweFollowUps } from "../follow-ups/owe-follow-ups";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";

export type GoalRebuildFollowUp = { id: string; revision: number };

/** Internal: generation admission checked this goal's owner. Retries share one active ask. */
export async function requestGoalRebuild(goal: Goal): Promise<GoalRebuildFollowUp | null> {
  if (goal.kind === "explain") {
    return null;
  }

  const result = await writeLearnerChange<GoalRebuildFollowUp | null>(
    { userId: goal.userId },
    async (tx) => {
      const where = {
        userKindKey: { key: goal.id, kind: "rebuildGoalCurriculum" as const, userId: goal.userId },
      };

      const owed = await tx.followUp.findUnique({ where });

      if (!owed || !owed.failedAt) {
        return unchanged(owed ? { id: owed.id, revision: owed.revision } : null);
      }

      await oweFollowUps({
        db: tx,
        followUps: [{ input: { goalId: goal.id }, kind: "rebuildGoalCurriculum" }],
        userId: goal.userId,
      });

      const retried = await tx.followUp.findUniqueOrThrow({ where });
      return { id: retried.id, revision: retried.revision };
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
        failedAt: null,
        id: followUp.id,
        key: goalId,
        kind: "rebuildGoalCurriculum",
        revision: followUp.revision,
      },
    })) > 0
  );
}

/** A newer ask replaces the input, so only this revision can claim its own saved graph. */
export async function recordGoalRebuildSaved({
  followUp,
  goalId,
}: {
  followUp: GoalRebuildFollowUp;
  goalId: string;
}): Promise<void> {
  await prisma.followUp.updateMany({
    data: { input: { goalId, graphSaved: true } },
    where: {
      id: followUp.id,
      key: goalId,
      kind: "rebuildGoalCurriculum",
      revision: followUp.revision,
    },
  });
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

      const saved = plan
        ? await tx.plan.findUnique({
            select: { goal: { select: { generationRunId: true } } },
            where: { id: plan.id },
          })
        : null;

      const failedAt = new Date();
      const ownFailure = failed && saved?.goal.generationRunId === generationId;

      if (ownFailure) {
        await tx.plan.updateMany({ data: { buildFailedAt: failedAt }, where: { goalId } });
      }

      const graphSaved = isJsonObject(current.input) && current.input.graphSaved === true;

      if (ownFailure && !graphSaved) {
        await tx.followUp.update({ data: { failedAt }, where: { id: row.id } });
      } else {
        await tx.followUp.deleteMany({ where: { id: row.id, revision: followUp.revision } });
      }

      return true;
    },
  );

  if (changed) {
    revalidateCacheTags([getGoalsCacheTag(row.userId), getLearnerModelCacheTag(row.userId)]);
  }
}
