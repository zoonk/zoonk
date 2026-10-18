import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { resolvePlanInputDependents } from "../../../plans/_utils/plan-input-dependencies";
import { PlanInputWriteConflictError, lockPlanInputWrite } from "../../_utils/plan-input-write";
import { lockSkillAttribution } from "./lock-skill-attribution";

type SkillInputs = {
  masterySkillId?: string;
  referencedSkillIds?: readonly string[];
  skillIds: readonly string[];
};

async function loadPlanIds(tx: TransactionClient, input: SkillInputs) {
  const [dependentPlanIds, mastery] = await Promise.all([
    resolvePlanInputDependents(tx, { skillIds: input.skillIds }),
    input.masterySkillId
      ? tx.learnerSkill.findMany({ where: { skillId: input.masterySkillId } })
      : Promise.resolve([]),
  ]);

  const masteryPlans =
    mastery.length > 0
      ? await tx.plan.findMany({
          where: { goal: { userId: { in: mastery.map(({ userId }) => userId) } } },
        })
      : [];

  return [...new Set([...dependentPlanIds, ...masteryPlans.map(({ id }) => id)])];
}

/** A moved edge needs FK locks on both endpoints, even when another merge owns its other end. */
async function loadLockIds(
  tx: TransactionClient,
  { masterySkillId, referencedSkillIds = [], skillIds }: SkillInputs,
) {
  const [edges, aliases] = await Promise.all([
    tx.skillPrerequisite.findMany({
      where: {
        OR: [
          { skillId: { in: [...skillIds] } },
          // Merges move incoming edges too; a setter changes only its own outgoing edges.
          ...(masterySkillId ? [{ prerequisiteId: { in: [...skillIds] } }] : []),
        ],
      },
    }),
    tx.skill.findMany({ where: { mergedIntoId: { in: [...skillIds] } } }),
  ]);

  return [
    ...new Set([
      ...skillIds,
      ...referencedSkillIds,
      ...aliases.map(({ id }) => id),
      ...edges.flatMap(({ skillId, prerequisiteId }) => [skillId, prerequisiteId]),
    ]),
  ];
}

async function lockSources({
  input,
  lockIds,
  tx,
}: {
  input: SkillInputs;
  lockIds: string[];
  tx: TransactionClient;
}) {
  if (input.masterySkillId && !(await lockSkillAttribution({ mode: "merge", tx }))) {
    throw new PlanInputWriteConflictError(
      "Skill attribution recovery is running; try the merge again.",
    );
  }

  await tx.$queryRaw`
    SELECT id FROM skills WHERE id = ANY(${lockIds}::uuid[])
    ORDER BY id FOR UPDATE
  `;

  const currentLockIds = await loadLockIds(tx, input);
  const locked = new Set(lockIds);

  if (currentLockIds.some((id) => !locked.has(id))) {
    throw new PlanInputWriteConflictError("Skill references changed; try the write again.");
  }
}

/** Lock plans and users before the complete skill endpoint set, then verify both sets stayed complete. */
export async function lockSkillPlanInputs({
  tx,
  ...input
}: SkillInputs & { tx: TransactionClient }) {
  const lockIds = await loadLockIds(tx, input);

  await lockPlanInputWrite({
    loadPlanIds: () => loadPlanIds(tx, input),
    lockSources: () => lockSources({ input, lockIds, tx }),
    tx,
  });
}
