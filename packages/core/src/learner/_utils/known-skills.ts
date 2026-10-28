import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { announceTestedOutItems } from "../../plans/announce-tested-out-items";
import { INFERRED_KNOWN_ANSWER } from "../answer-rating";
import { NEW_SKILL_MEMORY, reviewSkillMemory } from "../fsrs-scheduler";
import { type GoalPlan, type GoalPlanItem, loadGoalPlan } from "./goal-skill-graph";
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

type LeftOutSkill = Pick<GoalPlan["skills"][number], "id" | "phase">;

type TestOutInput = {
  items: readonly GoalPlanItem[];
  knownSkillIds: ReadonlySet<string>;
  placedSkills?: readonly LeftOutSkill[];
};

function findTestOut({ items, knownSkillIds, placedSkills = [] }: TestOutInput) {
  const planned = new Set(items.flatMap((item) => item.skillIds));

  return {
    ids: items
      .filter(
        (item) =>
          item.status === "todo" &&
          item.skillIds.length > 0 &&
          item.skillIds.every((skillId) => knownSkillIds.has(skillId)),
      )
      .map((item) => item.id),
    leftOut: placedSkills.filter((skill) => knownSkillIds.has(skill.id) && !planned.has(skill.id)),
  };
}

async function insertTestedOutStandIns(
  tx: TransactionClient,
  {
    goalId,
    skills,
    testedOutAt,
    timeZone,
  }: { goalId: string; skills: readonly LeftOutSkill[]; testedOutAt: Date; timeZone: string },
): Promise<string[]> {
  const plan = await tx.plan.findUnique({ select: { id: true }, where: { goalId } });

  if (!plan) {
    return [];
  }

  const skillIds = skills.map((skill) => skill.id);

  const [last, planned, names] = await Promise.all([
    tx.planItem.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
      where: { planId: plan.id },
    }),
    tx.planItem.findMany({
      select: { skillId: true },
      where: { planId: plan.id, skillId: { in: skillIds } },
    }),
    tx.skill.findMany({ select: { id: true, name: true }, where: { id: { in: skillIds } } }),
  ]);

  const plannedIds = new Set(planned.map((item) => item.skillId));
  const missing = skills.filter((skill) => !plannedIds.has(skill.id));

  if (missing.length === 0) {
    return [];
  }

  await tx.$executeRaw`UPDATE plans SET version = version + 1 WHERE id = ${plan.id}::uuid`;
  const after = (last?.position ?? -1) + 1;
  const nameOf = new Map(names.map((skill) => [skill.id, skill.name]));

  const created = await tx.planItem.createManyAndReturn({
    data: missing.map((skill, index) => ({
      completedAt: testedOutAt,
      kind: "lesson" as const,
      phase: skill.phase,
      planId: plan.id,
      position: after + index,
      scheduledFor: getDateInTimeZone({ date: testedOutAt, timeZone }),
      skillId: skill.id,
      status: "testedOut" as const,
      titleSnapshot: nameOf.get(skill.id) ?? "",
    })),
    select: { id: true },
  });

  return created.map((item) => item.id);
}

/** Caller must hold the marked learner's plans; returns only changed items and inserted stand-ins, in plan order. */
export async function testOutKnownPlanItems(
  tx: TransactionClient,
  {
    goalId,
    testedOutAt,
    timeZone,
    ...input
  }: TestOutInput & { goalId: string; testedOutAt: Date; timeZone: string },
): Promise<{ itemIds: string[]; standInIds: string[] }> {
  const { ids, leftOut } = findTestOut(input);

  const updated =
    ids.length > 0
      ? await tx.planItem.updateManyAndReturn({
          data: { completedAt: testedOutAt, status: "testedOut" },
          select: { id: true },
          where: { id: { in: ids }, status: "todo" },
        })
      : [];

  const standInIds =
    leftOut.length > 0
      ? await insertTestedOutStandIns(tx, { goalId, skills: leftOut, testedOutAt, timeZone })
      : [];

  const changed = new Set(updated.map((item) => item.id));
  return { itemIds: ids.filter((id) => changed.has(id)), standInIds };
}

/** Returns changed ids, the announcement's undoable plan change, lesson count, and resulting version; only todo items change. */
export async function markPlanItemsTestedOut({
  announceAlso = [],
  extraWrites,
  followToday = true,
  goalId,
  items,
  knownSkillIds,
  now,
  pastBasicsAreas,
  placedSkills = [],
  testedOutAt,
  timeZone,
}: {
  /** Items tested out before that were never announced, for the announcement to carry too. */
  announceAlso?: readonly string[];
  /** Other writes that must land with the announcement (see `announceTestedOutItems`). */
  extraWrites?: (tx: TransactionClient) => Promise<unknown>;
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
  lessonsSkipped: number;
  planItemIds: string[];
  planVersion: number | null;
}> {
  const { ids, leftOut } = findTestOut({ items, knownSkillIds, placedSkills });
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });

  if (!goal) {
    return { changeId: null, lessonsSkipped: 0, planItemIds: [], planVersion: null };
  }

  const standInIds =
    ids.length > 0 || leftOut.length > 0
      ? await writeLearnerChange({ planInputs: true, userId: goal.userId }, async (tx) => {
          const changed = await testOutKnownPlanItems(tx, {
            goalId,
            items,
            knownSkillIds,
            placedSkills,
            testedOutAt,
            timeZone,
          });

          return changed.itemIds.length === 0 && changed.standInIds.length === 0
            ? unchanged(changed.standInIds)
            : changed.standInIds;
        })
      : [];

  const planItemIds = [...ids, ...standInIds];
  const announced = [...new Set([...announceAlso, ...planItemIds])];

  if (announced.length === 0) {
    return { changeId: null, lessonsSkipped: 0, planItemIds: [], planVersion: null };
  }

  const announcement = await announceTestedOutItems({
    extraWrites,
    followToday,
    goalId,
    now: now ?? testedOutAt,
    pastBasicsAreas,
    planItemIds: announced,
    timeZone,
  });

  return {
    changeId: announcement?.changeId ?? null,
    lessonsSkipped: announcement?.lessonsSkipped ?? planItemIds.length,
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

/** Preserves memory backed by real answers; unstudied assumed skills revert to New. */
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

  const answered = await tx.attempt.findMany({
    distinct: ["skillId"],
    select: { skillId: true },
    where: { skillId: { in: [...skillIds] }, userId },
  });

  const answeredIds = new Set(answered.map((attempt) => attempt.skillId));

  await tx.learnerSkill.updateMany({
    data: NEW_SKILL_MEMORY,
    where: { skillId: { in: skillIds.filter((skillId) => !answeredIds.has(skillId)) }, userId },
  });
}
