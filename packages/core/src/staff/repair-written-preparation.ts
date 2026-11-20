import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../cache/tags";
import { oweFollowUps } from "../follow-ups/owe-follow-ups";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { getWritingSkillIds } from "../learner/writing-skills";
import { loadWritingEvidence } from "../learner/written-evidence";
import { getSharedExamNotice } from "../library/exams/exam-identity";
import { readBlueprintContent } from "../library/exams/save-exam-blueprint";
import { parsePlanGraph } from "../plans/planner/plan-state";

const PAGE_SIZE = 20;

export async function listWrittenBlueprintRepairs({ after }: { after?: string }) {
  const rows = await prisma.examBlueprint.findMany({
    orderBy: { id: "asc" },
    take: PAGE_SIZE,
    where: { id: { gt: after } },
  });

  const entries = await Promise.all(
    rows.map(async (blueprint) => {
      const { structure } = readBlueprintContent(blueprint);
      const sections = (structure.mock?.sections ?? []).filter(({ kind }) => kind === "written");
      const tasks = sections.flatMap((section) => section.tasks ?? []);
      const written = sections.length > 0 || structure.formats.some(({ kind }) => kind === "essay");

      if (!written) {
        return null;
      }

      if (tasks.length > 0 && tasks.every(({ grading, key }) => grading && key)) {
        return { blueprintId: blueprint.id, status: "keyed" as const };
      }

      const notice = await getSharedExamNotice(blueprint.id);

      return {
        blueprintId: blueprint.id,
        status: notice ? ("needsReading" as const) : ("missingNotice" as const),
      };
    }),
  );

  return {
    entries: entries.filter((entry) => entry !== null),
    next: rows.length === PAGE_SIZE ? rows.at(-1)?.id : undefined,
  };
}

async function identifyFalseClaims({
  goalId,
  tx,
  userId,
}: {
  goalId: string;
  tx: TransactionClient;
  userId: string;
}) {
  const goal = await tx.goal.findFirst({
    select: { examBlueprint: true, plan: { select: { graph: true, id: true } } },
    where: { id: goalId, kind: "exam", status: "active", userId },
  });

  if (!goal?.examBlueprint || !goal.plan) {
    return null;
  }

  const { structure } = readBlueprintContent(goal.examBlueprint);
  const written = getWritingSkillIds({ graph: parsePlanGraph(goal.plan.graph), structure });

  const evidence = await loadWritingEvidence({
    examBlueprintId: goal.examBlueprint.id,
    skillIds: written,
    tx,
    userId,
  });

  const supported = new Set(evidence.map(({ skillId }) => skillId));
  const unsupported = [...written].filter((id) => !supported.has(id));

  const [settled, testedOut] = await Promise.all([
    tx.learnerSkill.findMany({
      select: { skillId: true },
      where: { skillId: { in: unsupported }, state: { in: ["mastered", "solid"] }, userId },
    }),
    tx.planItem.findMany({
      select: { id: true, skillId: true },
      where: { planId: goal.plan.id, skillId: { in: unsupported }, status: "testedOut" },
    }),
  ]);

  const invalid = new Set([
    ...settled.map(({ skillId }) => skillId),
    ...testedOut.flatMap(({ skillId }) => skillId ?? []),
  ]);

  return { invalid: [...invalid], testedOut };
}

/** Internal staff capability. The caller authenticates and audits the staff actor. */
/** @internal */
export async function repairWrittenGoal({
  apply,
  goalId,
  userId,
}: {
  apply: boolean;
  goalId: string;
  userId: string;
}): Promise<number> {
  if (!apply) {
    const preview = await identifyFalseClaims({ goalId, tx: prisma, userId });
    return preview?.invalid.length ?? 0;
  }

  const reopened = await writeLearnerChange(
    { goalIds: [goalId], planInputs: true, userId },
    async (tx) => {
      const result = await identifyFalseClaims({ goalId, tx, userId });

      if (!result || result.invalid.length === 0) {
        return unchanged(0);
      }

      await tx.learnerSkill.updateMany({
        data: {
          difficulty: 0,
          due: null,
          lapses: 0,
          lastReviewedAt: null,
          recallDays: 0,
          reps: 0,
          stability: 0,
          state: "new",
        },
        where: { skillId: { in: result.invalid }, userId },
      });

      await tx.planItem.updateMany({
        data: { completedAt: null, status: "todo" },
        where: { id: { in: result.testedOut.map(({ id }) => id) } },
      });

      await oweFollowUps({
        db: tx,
        followUps: [{ input: { goalId }, kind: "rebuildGoalCurriculum" }],
        userId,
      });

      return result.invalid.length;
    },
  );

  if (reopened > 0) {
    revalidateCacheTags([getGoalsCacheTag(userId), getLearnerModelCacheTag(userId)]);
  }

  return reopened;
}

export async function listWrittenGoalRepairs({ apply, after }: { apply: boolean; after?: string }) {
  const goals = await prisma.goal.findMany({
    orderBy: { id: "asc" },
    select: { id: true, userId: true },
    take: PAGE_SIZE,
    where: { examBlueprintId: { not: null }, id: { gt: after }, kind: "exam", status: "active" },
  });

  const entries = [];

  for (const { id: goalId, userId } of goals) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- Consecutive goals can share a learner and their skill rows.
      const skills = await repairWrittenGoal({ apply, goalId, userId });

      const changed = apply ? "reopened" : "eligible";
      entries.push({ goalId, skills, status: skills ? changed : "unchanged" });
    } catch {
      entries.push({ goalId, skills: 0, status: "failed" });
    }
  }

  return { entries, next: goals.length === PAGE_SIZE ? goals.at(-1)?.id : undefined };
}
