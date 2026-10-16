import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
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

/** Where placing the test's result on the plan stands (see `levelTestProgressSchema`). */
type ResultPlacement = NonNullable<LevelTestProgress["placement"]>;

/**
 * Where a finish left placing the result, and whether it placed it; null on a test ended before
 * results were placed this way. `changed`: the goal changed while placement read it.
 */
type PlaceOutcome = { placedNow: boolean; placement: ResultPlacement } | null | "changed";

/** How many times a finish reads the goal again when it changed while placement read it. */
const MAX_PLACEMENT_ATTEMPTS = 3;

/** Another finish announced it first: thrown in the announcement's transaction, which rolls back. */
class PlacementAnnouncedError extends Error {
  override name = "PlacementAnnouncedError";
}

/**
 * Locks the goal and reads it. Every step of a finish, every announcement and every undo holds the
 * learner's lock first, so each one sees where placing the test's result stands as the last one
 * left it, and changes it with its own effects.
 */
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

/** The goal as placement reads it: all its details but where placing the result stands. */
function readPlacementInput(goal: Pick<Goal, "details">) {
  return {
    ...readGoalDetails(goal),
    levelTest: { ...readLevelTestProgress(goal), placement: null },
  };
}

/**
 * Places the test's result on the plan as `applyPlacement` does, in one transaction: skills it's
 * sure the learner knows become known, and the plan's items teaching only those are tested out,
 * with stand-ins for the ones its time leaves out. Only a finish that finds the result unplaced
 * places it, so no other finish places it again, even one that stalled until the learner undid
 * it. It keeps what the plan must announce, with what an earlier result left unannounced. A goal
 * that changed while placement read it is read again.
 */
export async function placeLevelTestResult(
  input: { goalId: string; timeZone: string; userId: string },
  attempt = 1,
): Promise<Exclude<PlaceOutcome, "changed">> {
  const { goalId, timeZone, userId } = input;
  const read = await prisma.goal.findUnique({ where: { id: goalId } });
  const found = read ? readLevelTestProgress(read).placement : undefined;

  if (!read || !found || found.placed) {
    return found ? { placedNow: false, placement: found } : null;
  }

  const now = new Date();
  const { goalPlan, pastBasicsAreas, state } = await loadPlacement({ goalId, userId });

  // Placement changes the plan's inputs only when the learner knows some of its skills.
  const outcome = await writeLearnerChange<PlaceOutcome>(
    { planInputs: state.knownSkillIds.length > 0, userId },
    async (tx) => {
      const goal = await lockGoal(tx, goalId);
      const current = goal ? readLevelTestProgress(goal).placement : undefined;

      if (!goal || !current || current.placed) {
        return unchanged(current ? { placedNow: false, placement: current } : null);
      }

      if (!isDeepStrictEqual(readPlacementInput(goal), readPlacementInput(read))) {
        return unchanged("changed");
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

      // The listening areas land with the announcement; with nothing to announce, nothing does.
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
    },
  );

  if (outcome !== "changed") {
    if (outcome?.placedNow) {
      revalidateCacheTags([getLearnerModelCacheTag(userId)]);
    }

    return outcome;
  }

  if (attempt >= MAX_PLACEMENT_ATTEMPTS) {
    throw new Error("The goal kept changing while its level test's result was placed.");
  }

  return placeLevelTestResult(input, attempt + 1);
}

/**
 * Clears what the plan announced from the result's placement, when it's still what `announced`
 * says: else another finish announced it first, or placed a newer result whose announcement
 * carries it. Returns whether it cleared it.
 */
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

/**
 * Says on the plan what placing the result skipped ("Skipped 12 lessons you already know", with an
 * undo) and re-plans from today, once: the announcement clears it from the placement in its own
 * transaction, and rolls back when another finish announced it first. A plan that isn't the
 * planner's yet announces nothing, so nothing is left to announce.
 */
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
