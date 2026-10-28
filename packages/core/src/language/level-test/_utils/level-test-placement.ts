import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import {
  lockLearner,
  lockLearnerPlans,
  markLockedPlanInputsChanged,
} from "@zoonk/db/learner-writes";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../../cache/tags";
import { markSkillsKnown, testOutKnownPlanItems } from "../../../learner/_utils/known-skills";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { loadPlacement } from "../../../learner/placement/_utils/apply-placement";
import { announceTestedOutItems } from "../../../plans/announce-tested-out-items";
import { readGoalDetails } from "../../_utils/language-goal";
import { type LevelTestProgress } from "../level-test-contract";
import { readLevelTestProgress } from "./level-test-state";

type ResultPlacement = NonNullable<LevelTestProgress["placement"]>;

type PlaceOutcome = { placedNow: boolean; placement: ResultPlacement } | null;

class PlacementAnnouncedError extends Error {
  override name = "PlacementAnnouncedError";
}

async function lockGoal(tx: TransactionClient, goalId: string): Promise<Goal | null> {
  await tx.$queryRaw`SELECT id FROM goals WHERE id = ${goalId}::uuid FOR UPDATE`;
  return tx.goal.findUnique({ where: { id: goalId } });
}

async function savePlacement(
  tx: TransactionClient,
  { goal, placement }: { goal: Goal; placement: ResultPlacement },
) {
  const levelTest = { ...readLevelTestProgress(goal), placement };

  await tx.goal.update({
    data: { details: { ...readGoalDetails(goal), levelTest } },
    where: { id: goal.id },
  });
}

export async function placeLevelTestResult({
  goalId,
  timeZone,
  userId,
}: {
  goalId: string;
  timeZone: string;
  userId: string;
}): Promise<PlaceOutcome> {
  const now = new Date();

  const outcome = await prisma.$transaction(async (tx) => {
    const planIds = await lockLearnerPlans(tx, { userIds: [userId] });
    await lockLearner(tx, { userId });
    const goal = await lockGoal(tx, goalId);
    const current = goal ? readLevelTestProgress(goal).placement : undefined;

    if (!goal || !current || current.placed) {
      return current ? { placedNow: false, placement: current } : null;
    }

    const { goalPlan, pastBasicsAreas, state } = await loadPlacement({ goalId, tx, userId });

    if (state.knownSkillIds.length > 0) {
      await markLockedPlanInputsChanged(tx, { planIds });
    }

    await markSkillsKnown({
      knownAt: now,
      skillIds: state.knownSkillIds,
      timeZone,
      transaction: tx,
      userId,
    });

    const { itemIds, standInIds } = await testOutKnownPlanItems(tx, {
      goalId,
      items: goalPlan.items,
      knownSkillIds: new Set(state.knownSkillIds),
      placedSkills: goalPlan.skills,
      testedOutAt: now,
      timeZone,
    });

    const unannounced = [...new Set([...current.unannounced, ...itemIds, ...standInIds])];

    const placement = {
      pastBasicsAreas:
        unannounced.length > 0
          ? [...new Set([...current.pastBasicsAreas, ...pastBasicsAreas])]
          : [],
      placed: true,
      unannounced,
    };

    await savePlacement(tx, { goal, placement });
    return { placedNow: true, placement };
  });

  if (outcome?.placedNow) {
    revalidateCacheTags([getLearnerModelCacheTag(userId)]);
  }

  return outcome;
}

async function clearAnnounced(
  tx: TransactionClient,
  { announced, goalId }: { announced: ResultPlacement; goalId: string },
): Promise<boolean> {
  const goal = await lockGoal(tx, goalId);
  const current = goal ? readLevelTestProgress(goal).placement : undefined;

  if (
    !goal ||
    !current ||
    !isDeepStrictEqual(
      [current.unannounced, current.pastBasicsAreas],
      [announced.unannounced, announced.pastBasicsAreas],
    )
  ) {
    return false;
  }

  await savePlacement(tx, {
    goal,
    placement: { ...current, pastBasicsAreas: [], unannounced: [] },
  });

  return true;
}

export async function announceLevelTestPlacement({
  goalId,
  placement,
  timeZone,
  userId,
}: {
  goalId: string;
  placement: ResultPlacement;
  timeZone: string;
  userId: string;
}) {
  if (placement.unannounced.length === 0) {
    return;
  }

  const { data, error } = await safeAsync(() =>
    announceTestedOutItems({
      extraWrites: async (tx) => {
        if (!(await clearAnnounced(tx, { announced: placement, goalId }))) {
          throw new PlacementAnnouncedError();
        }
      },
      goalId,
      now: new Date(),
      pastBasicsAreas: placement.pastBasicsAreas,
      planItemIds: placement.unannounced,
      timeZone,
    }),
  );

  if (error instanceof PlacementAnnouncedError || data) {
    return;
  }

  if (error) {
    throw error;
  }

  await writeLearnerChange({ userId }, async (tx) =>
    (await clearAnnounced(tx, { announced: placement, goalId })) ? null : unchanged(null),
  );
}
