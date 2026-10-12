import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../../cache/tags";
import { listPlacementListeningAreas } from "../../../plans/_utils/load-listening-starts";
import { endPlanSetupTask, endPlanSetupTaskWith } from "../../../plans/_utils/plan-setup-tasks";
import { type GoalPlan, loadPlacementPlan } from "../../_utils/goal-skill-graph";
import { markPlanItemsTestedOut, markSkillsKnown } from "../../_utils/known-skills";
import { getAnswerTimeZone } from "../../_utils/owned-goal";
import { type PlacementEvidence } from "../placement-beliefs";
import { type PlacementState, loadPlacementState } from "./load-placement-state";

/**
 * Applies what placement knows, on every skill of the goal's skill graph: skills it's sure the
 * learner can do become known in the learner model, plan items teaching only known skills are
 * tested out, and known skills the plan's time leaves out get tested-out stand-ins, so no re-plan
 * brings them back; a language exam's listening areas start past the basics of the bands its text
 * answers confirmed (`listPlacementListeningAreas`). The plan announces all of it with an undo.
 * Returns the placement it applied, the plan items it tested out, the listening areas it started
 * past their basics and the change that announced them (null when there was nothing to announce,
 * or the plan isn't the planner's yet).
 */
export async function applyPlacement({
  announceAlso,
  answer = null,
  extraWrites,
  goalId,
  now,
  plan,
  testedOutAt = now,
  timeZone,
  userId,
}: {
  /** Items tested out earlier and never announced (see `applyPlacementToNewPlan`). */
  announceAlso?: readonly string[];
  /** The placement question a first-week session just asked, answered (see `loadPlacementState`). */
  answer?: PlacementEvidence | null;
  /** Other writes that must land with the announcement. */
  extraWrites?: (tx: TransactionClient) => Promise<unknown>;
  goalId: string;
  now: Date;
  plan?: GoalPlan;
  /** When the items are tested out: `now`, unless a retry keeps an earlier attempt's time. */
  testedOutAt?: Date;
  timeZone: string;
  userId: string;
}): Promise<{
  changeId: string | null;
  pastBasicsAreas: string[];
  state: PlacementState;
  testedOutPlanItemIds: string[];
}> {
  const goalPlan = plan ?? (await loadPlacementPlan(goalId));
  const state = await loadPlacementState({ answer, goalId, plan: goalPlan, userId });

  const [pastBasicsAreas] = await Promise.all([
    listPlacementListeningAreas({
      goalId,
      knownSkillIds: state.knownSkillIds,
      skills: goalPlan.skills,
      userId,
    }),
    markSkillsKnown({ knownAt: now, skillIds: state.knownSkillIds, timeZone, userId }),
  ]);

  // A question inside today's session keeps the rest of the day as the learner was shown it.
  const { changeId, planItemIds: testedOutPlanItemIds } = await markPlanItemsTestedOut({
    announceAlso,
    extraWrites,
    followToday: answer === null,
    goalId,
    items: goalPlan.items,
    knownSkillIds: new Set(state.knownSkillIds),
    now,
    pastBasicsAreas,
    placedSkills: goalPlan.skills,
    testedOutAt,
    timeZone,
  });

  revalidateCacheTags([getLearnerModelCacheTag(userId)]);

  return { changeId, pastBasicsAreas, state, testedOutPlanItemIds };
}

function endedPlacement(details: unknown): boolean {
  const record = isJsonObject(details) ? details : {};
  const answered = Array.isArray(record.answered) ? record.answered : [];

  return answered.includes("placement") && record.placementDeclined !== true;
}

/**
 * Applies placement to a goal's plan the moment it's first built, when the learner already ended
 * placement (or a language goal's level test) before the plan existed: what their level and
 * answers settled is tested out right away, so day one starts past it. It's the plan's
 * `placement` setup task (see `runPlanSetupTask`): its items are tested out as of the plan's
 * creation, whichever attempt does it, so a retry after an attempt that failed before announcing
 * them announces them with the rest; the announcement ends the task in its own transaction, so
 * they're announced once.
 */
export async function applyPlacementToNewPlan(goalId: string): Promise<void> {
  const task = { goalId, task: "placement" as const };
  const plan = await prisma.plan.findUnique({ include: { goal: true }, where: { goalId } });

  if (!plan || !endedPlacement(plan.goal.details)) {
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

  // Nothing announced carried the task's end: placement settled nothing the plan holds.
  if (!changeId) {
    await endPlanSetupTask(task);
  }
}
