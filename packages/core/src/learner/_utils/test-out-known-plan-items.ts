import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { awardCourseCertificates } from "../../certificates/_utils/award-course-certificate";
import { type GoalPlan, type GoalPlanItem, loadGoalPlan } from "./goal-skill-graph";

export type LeftOutSkill = Pick<GoalPlan["skills"][number], "id" | "phase">;

export type TestOutInput = {
  items: readonly GoalPlanItem[];
  knownSkillIds: ReadonlySet<string>;
  placedSkills?: readonly LeftOutSkill[];
};

export function findTestOut({ items, knownSkillIds, placedSkills = [] }: TestOutInput) {
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

  const last = await tx.planItem.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
    where: { planId: plan.id },
  });

  const planned = await tx.planItem.findMany({
    select: { skillId: true },
    where: { planId: plan.id, skillId: { in: skillIds } },
  });

  const names = await tx.skill.findMany({
    select: { id: true, name: true },
    where: { id: { in: skillIds } },
  });

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
): Promise<{ itemIds: string[]; sharedItemIds: string[]; standInIds: string[] }> {
  const { ids, leftOut } = findTestOut(input);
  const goal = await tx.goal.findUniqueOrThrow({ where: { id: goalId } });

  const otherPlans =
    input.knownSkillIds.size > 0
      ? await tx.plan.findMany({ where: { goal: { id: { not: goalId }, userId: goal.userId } } })
      : [];

  const others = await Promise.all(
    otherPlans.map((plan) => loadGoalPlan(plan.goalId, undefined, { tx })),
  );

  const sharedIds = findTestOut({
    items: others.flatMap((plan) => plan.items),
    knownSkillIds: input.knownSkillIds,
  }).ids;

  const allIds = [...ids, ...sharedIds];

  const updated =
    allIds.length > 0
      ? await tx.planItem.updateManyAndReturn({
          data: { completedAt: testedOutAt, status: "testedOut" },
          select: { id: true, kind: true, phase: true, planId: true },
          where: { id: { in: allIds }, plan: { goal: { userId: goal.userId } }, status: "todo" },
        })
      : [];

  const standInIds =
    leftOut.length > 0
      ? await insertTestedOutStandIns(tx, { goalId, skills: leftOut, testedOutAt, timeZone })
      : [];

  await awardCourseCertificates(tx, { finished: updated });

  const changed = new Set(updated.map((item) => item.id));

  return {
    itemIds: ids.filter((id) => changed.has(id)),
    sharedItemIds: sharedIds.filter((id) => changed.has(id)),
    standInIds,
  };
}
