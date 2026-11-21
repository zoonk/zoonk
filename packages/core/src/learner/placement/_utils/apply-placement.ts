import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../../cache/tags";
import { endPlanSetupTask, endPlanSetupTaskWith } from "../../../plans/_utils/plan-setup-tasks";
import { type GoalPlan, loadPlacementPlan } from "../../_utils/goal-skill-graph";
import { markPlanItemsTestedOut, markSkillsKnown } from "../../_utils/known-skills";
import { loadConfirmedSkills } from "../../_utils/load-skill-claims";
import { getAnswerTimeZone } from "../../_utils/owned-goal";
import { isFocusTestStarted } from "../focus-test-state";
import { type PlacementState, loadPlacementState } from "./load-placement-state";

async function loadPlacement({
  goalId,
  plan,
  timeZone = "UTC",
  userId,
  tx = prisma,
}: {
  goalId: string;
  plan?: GoalPlan;
  timeZone?: string;
  userId: string;
  tx?: TransactionClient;
}): Promise<{ goalPlan: GoalPlan; state: PlacementState }> {
  const goalPlan = plan ?? (await loadPlacementPlan(goalId, tx));

  const loaded = await loadPlacementState({
    goalId,
    ignoreAttempt: true,
    plan: goalPlan,
    tx,
    userId,
  });

  const confirmed = await loadConfirmedSkills({
    goalId,
    skillIds: loaded.knownSkillIds,
    timeZone,
    tx,
    userId,
  });

  const state = {
    ...loaded,
    knownSkillIds: loaded.knownSkillIds.filter((skillId) => confirmed.has(skillId)),
  };

  return { goalPlan, state };
}

/** Announces skipped items with an undo; changeId is null when nothing can be announced yet. */
export async function applyPlacement({
  announceAlso,
  extraWrites,
  followToday = false,
  goalId,
  livingPlanDay,
  now,
  plan,
  testedOutAt = now,
  timeZone,
  userId,
}: {
  /** Items tested out earlier and never announced (see `applyPlacementToNewPlan`). */
  announceAlso?: readonly string[];
  /** Other writes that must land with the announcement. */
  extraWrites?: (tx: TransactionClient) => Promise<unknown>;
  followToday?: boolean;
  goalId: string;
  livingPlanDay?: string;
  now: Date;
  plan?: GoalPlan;
  /** When the items are tested out: `now`, unless a retry keeps an earlier attempt's time. */
  testedOutAt?: Date;
  timeZone: string;
  userId: string;
}): Promise<{ changeId: string | null; state: PlacementState; testedOutPlanItemIds: string[] }> {
  const { goalPlan, state } = await loadPlacement({ goalId, plan, timeZone, userId });

  await markSkillsKnown({ knownAt: now, skillIds: state.knownSkillIds, timeZone, userId });

  // A question inside today's session keeps the rest of the day as the learner was shown it.
  const { changeId, planItemIds: testedOutPlanItemIds } = await markPlanItemsTestedOut({
    announceAlso,
    extraWrites,
    followToday,
    goalId,
    items: goalPlan.items,
    knownSkillIds: new Set(state.knownSkillIds),
    livingPlanDay,
    now,
    placedSkills: goalPlan.skills,
    testedOutAt,
    timeZone,
  });

  revalidateCacheTags([getLearnerModelCacheTag(userId)]);

  return { changeId, state, testedOutPlanItemIds };
}

/** A learner who declined placement and later started the Focus test has answers to apply. */
function endedPlacement(goal: { details: unknown }): boolean {
  const record = isJsonObject(goal.details) ? goal.details : {};
  const answered = Array.isArray(record.answered) ? record.answered : [];

  return (
    answered.includes("placement") &&
    (record.placementDeclined !== true || isFocusTestStarted(goal))
  );
}

/** Test-outs and their announcement complete the setup task atomically, so retries announce skipped work once. */
export async function applyPlacementToNewPlan(goalId: string): Promise<void> {
  const task = { goalId, task: "placement" as const };
  const plan = await prisma.plan.findUnique({ include: { goal: true }, where: { goalId } });

  if (!plan || !endedPlacement(plan.goal)) {
    await endPlanSetupTask(task);
    return;
  }

  const earlier = await prisma.planItem.findMany({
    select: { id: true },
    where: { completedAt: plan.createdAt, planId: plan.id, status: "testedOut" },
  });

  const { changeId } = await applyPlacement({
    announceAlso: earlier.map((item) => item.id),
    extraWrites: endPlanSetupTaskWith(task),
    goalId,
    now: new Date(),
    testedOutAt: plan.createdAt,
    timeZone: getAnswerTimeZone({ goal: plan.goal }),
    userId: plan.goal.userId,
  });

  if (!changeId) {
    await endPlanSetupTask(task);
  }
}
