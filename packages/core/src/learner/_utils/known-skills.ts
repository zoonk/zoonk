import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { announceTestedOutItems } from "../../plans/announce-tested-out-items";
import { INFERRED_KNOWN_ANSWER } from "../answer-rating";
import { NEW_SKILL_MEMORY, reviewSkillMemory } from "../fsrs-scheduler";
import { type GoalPlan, type GoalPlanItem, loadGoalPlan } from "./goal-skill-graph";
import { unchanged, writeLearnerChange } from "./write-learner-change";

/**
 * Records skills placement takes as known (each one's own answers confirmed it) as one right answer
 * now. Skills the learner is already learning keep their memory: their real answers outrank this
 * record. Undoing the skip that followed takes it back (`forgetAssumedSkills`). With `transaction`,
 * it writes in the caller's, which marked the learner changed.
 */
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

/** A skill placement placed, which the plan may hold no item for. */
type LeftOutSkill = Pick<GoalPlan["skills"][number], "id" | "phase">;

type TestOutInput = {
  items: readonly GoalPlanItem[];
  knownSkillIds: ReadonlySet<string>;
  placedSkills?: readonly LeftOutSkill[];
};

/**
 * What a test-out changes on the plan: the items still to do that teach only known skills, and the
 * known skills of `placedSkills` the plan holds no item for (a skill the learner's time leaves out
 * for now), which get an item standing in for their lessons, already tested out. Every re-plan
 * keeps a tested-out skill out (`getSettledSkillIds`), so a plan that grows with more time never
 * brings back what placement skipped, and undoing the skip brings these back with the rest.
 */
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

/**
 * Inserts one tested-out stand-in per skill, after the plan's items, in the caller's transaction,
 * which holds the plan. It moves the plan's version on, so a re-plan computed meanwhile starts over
 * with them (`withPlanRetry`); a skill that got its item meanwhile is left alone.
 */
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

/**
 * Tests out, in the caller's transaction, the plan items still to do that teach only known skills,
 * and inserts the stand-ins of the known `placedSkills` the plan leaves out (see `findTestOut`),
 * together: the caller marked the learner's plan inputs changed first, so it holds their plans.
 * Returns what it changed: the items, in the plan's order, and the stand-ins. An item another
 * test-out changed first isn't among them.
 */
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

/**
 * Marks plan items as tested out when the learner knows every skill they teach, so the plan skips
 * them. Placement also passes the skills it placed (`placedSkills`, from `loadPlacementPlan`): the
 * known ones the plan leaves out get tested-out stand-ins (`findTestOut`). Only items still to do
 * change; done and skipped items stay as they are. The plan then says what it skipped and re-plans
 * from today: the items this call found still to do, whichever test-out changed them, so a run
 * whose announcement ends a task (`applyPlacementToNewPlan`) announces them even when another run
 * that lost its announcement tested them out first. Returns the ids, the plan change that
 * announced them (null when the plan isn't the planner's yet), whose undo brings them back, and
 * the lessons it says it skipped (`countLessons`: a stand-in, the lessons the plan taught in its
 * place), so a result says the count Today and the Plan say.
 */
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
  /** Areas the same answers start past their basics (see `announceTestedOutItems`). */
  pastBasicsAreas?: readonly string[];
  placedSkills?: readonly LeftOutSkill[];
  testedOutAt: Date;
  timeZone: string;
}): Promise<{ changeId: string | null; lessonsSkipped: number; planItemIds: string[] }> {
  const { ids, leftOut } = findTestOut({ items, knownSkillIds, placedSkills });
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });

  if (!goal) {
    return { changeId: null, lessonsSkipped: 0, planItemIds: [] };
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
    return { changeId: null, lessonsSkipped: 0, planItemIds: [] };
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
  };
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
