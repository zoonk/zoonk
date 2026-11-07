import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../cache/tags";
import { oweGoalLessons } from "../follow-ups/owe-goal-lessons";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { getOwnLevel } from "../learner/placement/placement-contract";
import { type OwnLevel } from "../learner/placement/placement-steps";
import { applyChangeNow } from "./_utils/apply-plan-change";
import { findFoundationOperations } from "./_utils/own-level-foundations";
import { findLevelTestOuts } from "./_utils/own-level-test-outs";
import { findOwnedPlan, loadPlanChangeView } from "./_utils/owned-plan";
import { type PlanContext } from "./_utils/plan-context";
import {
  OWN_LEVEL_SOURCE,
  type OwnLevelChangeInput,
  type OwnLevelChangeResult,
} from "./own-level-contract";
import { withPlanRetry } from "./plan-conflict";
import { type PlanChangeView } from "./plan-view-contract";
import { refreshGoalPlan } from "./refresh-goal-plan";

/** For logs and admin only; the apps word the foundations from the change's operations. */
const OWN_LEVEL_NOTE = "The learner lowered their own level; foundations were added.";

const LEVEL_ORDER: readonly OwnLevel[] = ["none", "basic", "intermediate", "advanced"];

const UNSTATED_LEVEL: OwnLevel = "intermediate";

function getDirection({ from, to }: { from: OwnLevel | null; to: OwnLevel }) {
  const before = LEVEL_ORDER.indexOf(from ?? UNSTATED_LEVEL);
  const after = LEVEL_ORDER.indexOf(to);

  if (after === before) {
    return "same" as const;
  }

  return after > before ? ("higher" as const) : ("lower" as const);
}

async function writeLevel({
  context,
  level,
  tx,
}: {
  context: PlanContext;
  level: OwnLevel;
  tx: TransactionClient;
}) {
  const goal = await tx.goal.findUniqueOrThrow({ where: { id: context.goal.id } });
  const details = isJsonObject(goal.details) ? goal.details : {};

  if (details.level === level) {
    return unchanged(goal);
  }

  const saved = await tx.goal.update({
    data: { details: { ...details, level } },
    where: { id: goal.id },
  });

  // The level decides what's written ahead, such as where lessons likely start.
  await oweGoalLessons({ db: tx, goalId: goal.id, userId: goal.userId });

  return saved;
}

async function saveLevel({ context, level }: { context: PlanContext; level: OwnLevel }) {
  await writeLearnerChange({ planInputs: true, userId: context.goal.userId }, (tx) =>
    writeLevel({ context, level, tx }),
  );

  revalidateCacheTags([getGoalsCacheTag(context.goal.userId)]);
}

async function addFoundations({
  context,
  level,
}: {
  context: PlanContext;
  level: OwnLevel;
}): Promise<PlanChangeView | null> {
  const plan = await loadGoalPlan(context.goal.id);
  const operations = await findFoundationOperations({ context, plan });

  if (operations.length === 0) {
    await saveLevel({ context, level });
    return null;
  }

  const details = isJsonObject(context.goal.details) ? context.goal.details : {};

  const result = await applyChangeNow({
    context: { ...context, goal: { ...context.goal, details: { ...details, level } } },
    extraWrites: (tx) => writeLevel({ context, level, tx }),
    followToday: true,
    operations,
    reason: OWN_LEVEL_NOTE,
    source: OWN_LEVEL_SOURCE,
  });

  return result.status === "applied" ? loadPlanChangeView(result.changeId) : null;
}

export async function changeOwnLevel({
  goalId,
  input,
}: {
  goalId: string;
  input: OwnLevelChangeInput;
}): Promise<OwnLevelChangeResult> {
  const owned = await findOwnedPlan({ goalId, timeZone: input.timeZone });

  if (owned.status !== "ready") {
    return owned;
  }

  const { context } = owned;
  const direction = getDirection({ from: getOwnLevel({ goal: context.goal }), to: input.level });

  return withPlanRetry(async () => {
    const current = await findOwnedPlan({ goalId, timeZone: input.timeZone });

    if (current.status !== "ready") {
      return current;
    }

    if (direction !== "lower") {
      await saveLevel({ context: current.context, level: input.level });
    }

    const [change, testOuts] = await Promise.all([
      direction === "lower"
        ? addFoundations({ context: current.context, level: input.level })
        : null,
      direction === "higher"
        ? loadGoalPlan(goalId).then((plan) => findLevelTestOuts({ level: input.level, plan }))
        : [],
    ]);

    await refreshGoalPlan({
      extraWrites: (tx) => oweGoalLessons({ db: tx, goalId, userId: current.context.goal.userId }),
      goalId,
    });

    return { ownLevel: { change, direction, level: input.level, testOuts }, status: "ready" };
  });
}
