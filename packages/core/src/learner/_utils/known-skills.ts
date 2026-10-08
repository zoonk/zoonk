import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { announceTestedOutItems } from "../../plans/announce-tested-out-items";
import { INFERRED_KNOWN_ANSWER } from "../answer-rating";
import { NEW_SKILL_MEMORY, reviewSkillMemory } from "../fsrs-scheduler";
import { type GoalPlan, type GoalPlanItem, loadGoalPlan } from "./goal-skill-graph";

/**
 * Records skills placement inferred the learner knows without asking about each one as one right
 * answer now. Skills the learner is already learning keep their memory: real answers outrank an
 * inference. Undoing the skip that followed takes it back (`forgetAssumedSkills`).
 */
export async function markSkillsKnown({
  knownAt,
  skillIds,
  timeZone,
  userId,
}: {
  knownAt: Date;
  skillIds: readonly string[];
  timeZone: string;
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

  await prisma.learnerSkill.createMany({
    data: skillIds.map((skillId) => ({ ...memory, skillId, userId })),
    skipDuplicates: true,
  });

  await prisma.learnerSkill.updateMany({
    data: memory,
    where: { reps: 0, skillId: { in: [...skillIds] }, userId },
  });
}

/** A skill placement placed, which the plan may hold no item for. */
type LeftOutSkill = Pick<GoalPlan["skills"][number], "id" | "phase">;

/**
 * Inserts one tested-out stand-in per skill, after the plan's items, under a lock on the plan that
 * also moves its version on: a re-plan computed meanwhile starts over with them (`withPlanRetry`),
 * and a skill that got its item meanwhile is left alone.
 */
async function insertTestedOutStandIns({
  goalId,
  skills,
  testedOutAt,
  timeZone,
}: {
  goalId: string;
  skills: readonly LeftOutSkill[];
  testedOutAt: Date;
  timeZone: string;
}): Promise<string[]> {
  const names = await prisma.skill.findMany({
    select: { id: true, name: true },
    where: { id: { in: skills.map((skill) => skill.id) } },
  });

  const nameOf = new Map(names.map((skill) => [skill.id, skill.name]));

  return prisma.$transaction(async (tx) => {
    const [plan] = await tx.$queryRaw<{ id: string }[]>`
      UPDATE plans SET version = version + 1 WHERE goal_id = ${goalId}::uuid RETURNING id`;

    if (!plan) {
      return [];
    }

    const [last, planned] = await Promise.all([
      tx.planItem.findFirst({
        orderBy: { position: "desc" },
        select: { position: true },
        where: { planId: plan.id },
      }),
      tx.planItem.findMany({
        select: { skillId: true },
        where: { planId: plan.id, skillId: { in: skills.map((skill) => skill.id) } },
      }),
    ]);

    const plannedIds = new Set(planned.map((item) => item.skillId));
    const missing = skills.filter((skill) => !plannedIds.has(skill.id));
    const after = (last?.position ?? -1) + 1;

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
  });
}

/**
 * Gives each known skill of `placedSkills` that the plan holds no item for (a skill the learner's
 * time leaves out for now) an item standing in for its lessons, already tested out. Every re-plan
 * keeps a tested-out skill out (`getSettledSkillIds`), so a plan that grows with more time never
 * brings back what placement skipped, and undoing the skip brings these back with the rest.
 * Returns the new items' ids.
 */
async function addTestedOutStandIns({
  goalId,
  items,
  knownSkillIds,
  placedSkills,
  testedOutAt,
  timeZone,
}: {
  goalId: string;
  items: readonly GoalPlanItem[];
  knownSkillIds: ReadonlySet<string>;
  placedSkills: readonly LeftOutSkill[];
  testedOutAt: Date;
  timeZone: string;
}): Promise<string[]> {
  const planned = new Set(items.flatMap((item) => item.skillIds));

  const leftOut = placedSkills.filter(
    (skill) => knownSkillIds.has(skill.id) && !planned.has(skill.id),
  );

  return leftOut.length === 0
    ? []
    : insertTestedOutStandIns({ goalId, skills: leftOut, testedOutAt, timeZone });
}

/**
 * Marks plan items as tested out when the learner knows every skill they teach, so the plan skips
 * them. Placement also passes the skills it placed (`placedSkills`, from `loadPlacementPlan`): the
 * known ones the plan leaves out get tested-out stand-ins (`addTestedOutStandIns`). Only items
 * still to do change; done and skipped items stay as they are. The plan then says what it skipped
 * and re-plans from today. Returns the ids and the plan change that announced them (null when the
 * plan isn't the planner's yet), whose undo brings them back.
 */
export async function markPlanItemsTestedOut({
  goalId,
  items,
  knownSkillIds,
  placedSkills = [],
  testedOutAt,
  timeZone,
}: {
  goalId: string;
  items: readonly GoalPlanItem[];
  knownSkillIds: ReadonlySet<string>;
  placedSkills?: readonly LeftOutSkill[];
  testedOutAt: Date;
  timeZone: string;
}): Promise<{ changeId: string | null; planItemIds: string[] }> {
  const ids = items
    .filter(
      (item) =>
        item.status === "todo" &&
        item.skillIds.length > 0 &&
        item.skillIds.every((skillId) => knownSkillIds.has(skillId)),
    )
    .map((item) => item.id);

  const [standInIds] = await Promise.all([
    addTestedOutStandIns({ goalId, items, knownSkillIds, placedSkills, testedOutAt, timeZone }),
    ids.length > 0
      ? prisma.planItem.updateMany({
          data: { completedAt: testedOutAt, status: "testedOut" },
          where: { id: { in: ids }, status: "todo" },
        })
      : null,
  ]);

  const planItemIds = [...ids, ...standInIds];

  if (planItemIds.length === 0) {
    return { changeId: null, planItemIds: [] };
  }

  const changeId = await announceTestedOutItems({
    goalId,
    now: testedOutAt,
    planItemIds,
    timeZone,
  });

  return { changeId, planItemIds };
}

/** The skills some of a goal's plan items teach, such as the ones a skip's undo brings back. */
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

/**
 * Takes back what `markSkillsKnown` assumed when a skip is undone: a skill the learner never
 * answered a question on goes back to New, so lessons back in the plan aren't counted as known.
 * Skills with answers keep the memory those answers built.
 */
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
