import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../cache/tags";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { getOwnLevel } from "../learner/placement/placement-contract";
import { type OwnLevel } from "../learner/placement/placement-steps";
import { applyChangeNow } from "./_utils/apply-plan-change";
import { findFoundationOperations } from "./_utils/own-level-foundations";
import { findLevelTestOuts } from "./_utils/own-level-test-outs";
import { findOwnedPlan, loadPlanChangeView } from "./_utils/owned-plan";
import { type PlanContext } from "./_utils/plan-context";
import { withPlanRetry } from "./_utils/replan";
import {
  OWN_LEVEL_SOURCE,
  type OwnLevelChangeInput,
  type OwnLevelChangeResult,
} from "./own-level-contract";
import { type PlanChangeView } from "./plan-view-contract";

/** Not shown to the learner: the app announces the foundations from the change's operations. */
const OWN_LEVEL_NOTE = "The learner lowered their own level; foundations were added.";

const LEVEL_ORDER: readonly OwnLevel[] = ["none", "basic", "intermediate", "advanced"];

/** Without a level given, placement started in the middle of the plan, as intermediate does. */
const UNSTATED_LEVEL: OwnLevel = "intermediate";

function getDirection({ from, to }: { from: OwnLevel | null; to: OwnLevel }) {
  const before = LEVEL_ORDER.indexOf(from ?? UNSTATED_LEVEL);
  const after = LEVEL_ORDER.indexOf(to);

  if (after === before) {
    return "same" as const;
  }

  return after > before ? ("higher" as const) : ("lower" as const);
}

async function saveLevel({ context, level }: { context: PlanContext; level: OwnLevel }) {
  const details = isJsonObject(context.goal.details) ? context.goal.details : {};

  await prisma.goal.update({
    data: { details: { ...details, level } },
    where: { id: context.goal.id },
  });

  revalidateCacheTags([getGoalsCacheTag(context.goal.userId)]);
}

/** Adds the foundations a lower level needs, with an undo; null when there's nothing to add. */
async function addFoundations(context: PlanContext): Promise<PlanChangeView | null> {
  const plan = await loadGoalPlan(context.goal.id);
  const operations = await findFoundationOperations({ context, plan });

  if (operations.length === 0) {
    return null;
  }

  const result = await applyChangeNow({
    context,
    followToday: true,
    operations,
    reason: OWN_LEVEL_NOTE,
    source: OWN_LEVEL_SOURCE,
  });

  return result.status === "applied" ? loadPlanChangeView(result.changeId) : null;
}

/**
 * Changes the learner's own level for a goal from the plan. Past work is never undone: known
 * skills and passed test-outs stay. A lower level adds the foundations the plan left out, right
 * before the skills they prepare for, as a change with an undo. A higher level skips nothing: it
 * offers test-outs for the chapters the new level covers. Placement starts from the new level.
 */
export async function changeOwnLevel({
  goalId,
  input,
}: {
  goalId: string;
  input: OwnLevelChangeInput;
}): Promise<OwnLevelChangeResult> {
  return withPlanRetry(async () => {
    const owned = await findOwnedPlan({ goalId, timeZone: input.timeZone });

    if (owned.status !== "ready") {
      return owned;
    }

    const { context } = owned;
    const direction = getDirection({ from: getOwnLevel({ goal: context.goal }), to: input.level });

    await saveLevel({ context, level: input.level });

    const [change, testOuts] = await Promise.all([
      direction === "lower" ? addFoundations(context) : null,
      direction === "higher"
        ? loadGoalPlan(goalId).then((plan) => findLevelTestOuts({ level: input.level, plan }))
        : [],
    ]);

    return { ownLevel: { change, direction, level: input.level, testOuts }, status: "ready" };
  });
}
