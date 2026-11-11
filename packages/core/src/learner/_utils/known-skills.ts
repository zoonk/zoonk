import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { settleFinishedChapters } from "../../mind-maps/finished-chapters";
import { announceSharedTestOuts } from "../../plans/announce-shared-test-outs";
import { announceTestedOutItems } from "../../plans/announce-tested-out-items";
import { afterPlanInputWrite } from "../../plans/plan-conflict";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { skipTestedOutBlocks } from "../../sessions/_utils/skip-tested-out-blocks";
import { type FinishedChapter } from "../../sessions/completion-contract";
import { INFERRED_KNOWN_ANSWER } from "../answer-rating";
import { NEW_SKILL_MEMORY, reviewSkillMemory } from "../fsrs-scheduler";
import { type GoalPlanItem, loadGoalPlan } from "./goal-skill-graph";
import { type LeftOutSkill, findTestOut, testOutKnownPlanItems } from "./test-out-known-plan-items";
import { unchanged, writeLearnerChange } from "./write-learner-change";

/** Existing learned memory outranks inferred knowledge. A supplied transaction must already have marked the learner changed. */
export async function markSkillsKnown({
  knownAt,
  skillIds,
  timeZone,
  transaction,
  userId,
}: {
  knownAt: Date;
  skillIds: readonly string[];
  timeZone: string;
  transaction?: TransactionClient;
  userId: string;
}): Promise<void> {
  if (skillIds.length === 0) {
    return;
  }

  const memory = reviewSkillMemory({
    answer: INFERRED_KNOWN_ANSWER,
    memory: NEW_SKILL_MEMORY,
    reviewedAt: knownAt,
    timeZone,
  });

  const write = async (tx: TransactionClient) => {
    const created = await tx.learnerSkill.createMany({
      data: skillIds.map((skillId) => ({ ...memory, skillId, userId })),
      skipDuplicates: true,
    });

    const updated = await tx.learnerSkill.updateMany({
      data: memory,
      where: { reps: 0, skillId: { in: [...skillIds] }, userId },
    });

    return created.count + updated.count;
  };

  if (transaction) {
    await write(transaction);
    return;
  }

  await writeLearnerChange({ planInputs: true, userId }, async (tx) =>
    (await write(tx)) === 0 ? unchanged(null) : null,
  );
}

/** Returns changed ids, the announcement's undoable plan change, lesson count, and resulting version; only todo items change. */
export async function markPlanItemsTestedOut({
  announceAlso = [],
  extraWrites,
  finishesChapters = false,
  followToday = true,
  goalId,
  items,
  knownSkillIds,
  now,
  pastBasicsAreas = [],
  placedSkills = [],
  testedOutAt,
  timeZone,
}: {
  /** Items tested out before that were never announced, for the announcement to carry too. */
  announceAlso?: readonly string[];
  /** Other writes that must land with the announcement (see `announceTestedOutItems`). */
  extraWrites?: (tx: TransactionClient) => Promise<unknown>;
  /**
   * Settles the chapters it finishes and owes their maps. Only a chapter's own test-out does:
   * placement and a mock's adaptation test out in bulk, which mustn't spend the learner's maps.
   */
  finishesChapters?: boolean;
  /** Today's blocks not started follow the re-plan (see `announceTestedOutItems`). */
  followToday?: boolean;
  goalId: string;
  items: readonly GoalPlanItem[];
  knownSkillIds: ReadonlySet<string>;
  /** When the plan is planned again from: `testedOutAt`, unless a retry kept an earlier one. */
  now?: Date;
  pastBasicsAreas?: readonly string[];
  placedSkills?: readonly LeftOutSkill[];
  testedOutAt: Date;
  timeZone: string;
}): Promise<{
  changeId: string | null;
  finishedChapters: FinishedChapter[];
  lessonsSkipped: number;
  pastBasicsAdded: string[];
  planItemIds: string[];
  planVersion: number | null;
}> {
  const empty = {
    changeId: null,
    finishedChapters: [],
    lessonsSkipped: 0,
    planItemIds: [],
    planVersion: null,
  };

  const { ids, leftOut } = findTestOut({ items, knownSkillIds, placedSkills });
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });

  if (!goal) {
    return { ...empty, pastBasicsAdded: [] };
  }

  const written =
    knownSkillIds.size > 0 || leftOut.length > 0 || pastBasicsAreas.length > 0
      ? await writeLearnerChange({ planInputs: true, userId: goal.userId }, async (tx) => {
          const changed = await testOutKnownPlanItems(tx, {
            goalId,
            items,
            knownSkillIds,
            placedSkills,
            testedOutAt,
            timeZone,
          });

          const plan =
            !extraWrites &&
            (followToday || ids.length > 0 || leftOut.length > 0) &&
            pastBasicsAreas.length > 0
              ? await tx.plan.findUnique({ where: { goalId } })
              : null;

          const settings = parsePlanSettings(plan?.settings);

          const pastBasicsAdded = plan
            ? pastBasicsAreas.filter((area) => !settings.pastBasicsAreas.includes(area))
            : [];

          if (plan && pastBasicsAdded.length > 0) {
            await tx.plan.update({
              data: {
                settings: {
                  ...settings,
                  pastBasicsAreas: [...settings.pastBasicsAreas, ...pastBasicsAdded],
                },
              },
              where: { id: plan.id },
            });
          }

          const finished = finishesChapters
            ? await settleFinishedChapters(tx, {
                planItemIds: [...changed.itemIds, ...changed.sharedItemIds, ...changed.standInIds],
                userId: goal.userId,
              })
            : [];

          const result = {
            finishedChapters: finished,
            pastBasicsAdded,
            standInIds: changed.standInIds,
          };

          return changed.itemIds.length === 0 &&
            changed.sharedItemIds.length === 0 &&
            changed.standInIds.length === 0 &&
            pastBasicsAdded.length === 0
            ? unchanged(result)
            : result;
        })
      : { finishedChapters: [], pastBasicsAdded: [], standInIds: [] };

  const { finishedChapters, pastBasicsAdded: addedBasics, standInIds } = written;

  const planItemIds = [...ids, ...standInIds];
  const announced = [...new Set([...announceAlso, ...planItemIds])];

  await announceSharedTestOuts({
    goalId,
    now: now ?? testedOutAt,
    testedOutAt,
    userId: goal.userId,
  });

  if (announced.length === 0) {
    return { ...empty, finishedChapters, pastBasicsAdded: addedBasics };
  }

  const announce = () =>
    announceTestedOutItems({
      extraWrites,
      followToday,
      goalId,
      now: now ?? testedOutAt,
      pastBasicsAdded: addedBasics,
      pastBasicsAreas: extraWrites ? pastBasicsAreas : [],
      planItemIds: announced,
      timeZone,
    });

  const announcement = extraWrites ? await announce() : await afterPlanInputWrite(announce);

  if (!announcement) {
    await skipTestedOutBlocks({ goalId, notStarted: true, planItemIds: announced });
  }

  return {
    changeId: announcement?.changeId ?? null,
    finishedChapters,
    lessonsSkipped: announcement?.lessonsSkipped ?? planItemIds.length,
    pastBasicsAdded: addedBasics,
    planItemIds,
    planVersion: announcement?.planVersion ?? null,
  };
}

export async function loadPlanItemSkillIds({
  goalId,
  planItemIds,
}: {
  goalId: string;
  planItemIds: readonly string[];
}): Promise<string[]> {
  const ids = new Set(planItemIds);
  const { items } = await loadGoalPlan(goalId);

  return [...new Set(items.filter((item) => ids.has(item.id)).flatMap((item) => item.skillIds))];
}

/** Preserves real answers and other plans' retained test-outs; remaining assumed skills revert to New. */
export async function forgetAssumedSkills({
  skillIds,
  tx,
  userId,
}: {
  skillIds: readonly string[];
  tx: TransactionClient;
  userId: string;
}): Promise<void> {
  if (skillIds.length === 0) {
    return;
  }

  const answered = await tx.attempt.groupBy({
    by: ["skillId"],
    where: { skillId: { in: [...skillIds] }, userId },
  });

  const answeredIds = new Set(answered.map((attempt) => attempt.skillId));

  const retainedPlans = await tx.plan.findMany({
    where: {
      goal: { status: { not: "archived" }, userId },
      items: { some: { status: "testedOut" } },
    },
  });

  const retained = await Promise.all(
    retainedPlans.map((plan) => loadGoalPlan(plan.goalId, undefined, { tx })),
  );

  const retainedSkillIds = new Set(
    retained.flatMap((plan) =>
      plan.items.flatMap((item) => (item.status === "testedOut" ? item.skillIds : [])),
    ),
  );

  await tx.learnerSkill.updateMany({
    data: NEW_SKILL_MEMORY,
    where: {
      skillId: {
        in: skillIds.filter(
          (skillId) => !answeredIds.has(skillId) && !retainedSkillIds.has(skillId),
        ),
      },
      userId,
    },
  });
}
