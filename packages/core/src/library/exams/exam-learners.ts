import "server-only";
import { type GoalKind, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { getReferenceSyllabusNeed } from "../curriculum/goal-curriculum-inputs";
import { toExamIdentity, toSharedContext } from "../curriculum/shared-graph-prompt";
import { readTestedLanguage } from "./blueprint-language";

export function countActiveExamGoals(examBlueprintId: string): Promise<number> {
  return prisma.goal.count({ where: { examBlueprintId, status: "active" } });
}

export function countNextEditionGoals({
  after,
  examBlueprintId,
}: {
  after: Date;
  examBlueprintId: string;
}): Promise<number> {
  return prisma.goal.count({
    where: { examBlueprintId, status: "active", targetDate: { gt: after } },
  });
}

export function countActiveSourceGoals(sourceId: string): Promise<number> {
  return prisma.goal.count({
    where: {
      OR: [{ learnerSources: { some: { sourceId } } }, { examBlueprint: { sourceId } }],
      status: "active",
    },
  });
}

export async function linkGoalToExamBlueprint({
  examBlueprintId,
  goalId,
}: {
  examBlueprintId: string;
  goalId: string;
}): Promise<boolean> {
  const blueprint = await prisma.examBlueprint.findUnique({
    select: { structure: true },
    where: { id: examBlueprintId },
  });

  const targetLanguage = blueprint ? readTestedLanguage(blueprint.structure) : null;

  const goal = await prisma.goal.findUnique({ where: { id: goalId } });

  if (!goal) {
    return false;
  }

  return writeLearnerChange({ planInputs: true, userId: goal.userId }, async (tx) => {
    const current = await tx.goal.findUnique({ where: { id: goalId } });

    if (!current) {
      return unchanged(false);
    }

    const language =
      current.kind === "exam" && targetLanguage ? targetLanguage : current.targetLanguage;

    if (current.examBlueprintId === examBlueprintId && current.targetLanguage === language) {
      return unchanged(true);
    }

    await tx.goal.update({
      data: { examBlueprintId, targetLanguage: language },
      where: { id: goalId },
    });

    return true;
  });
}

export async function unlinkGoalFromSharedExam(goalId: string): Promise<void> {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });

  if (!goal) {
    return;
  }

  await writeLearnerChange({ planInputs: true, userId: goal.userId }, async (tx) => {
    const updated = await tx.goal.updateMany({
      data: { examBlueprintId: null },
      where: { examBlueprint: { is: { visibility: "public" } }, id: goalId },
    });

    if (updated.count === 0) {
      return unchanged(null);
    }
  });
}

export async function linkGoalToResearchSources({
  goalId,
  sourceIds,
}: {
  goalId: string;
  sourceIds: string[];
}): Promise<void> {
  const goal = await prisma.goal.findUnique({ select: { userId: true }, where: { id: goalId } });

  if (!goal) {
    return;
  }

  await prisma.learnerSource.createMany({
    data: sourceIds.map((sourceId) => ({
      goalId,
      origin: "research",
      sourceId,
      userId: goal.userId,
    })),
    skipDuplicates: true,
  });
}

export async function getResearchGoal(goalId: string) {
  const goal = await prisma.goal.findUnique({
    select: {
      details: true,
      id: true,
      kind: true,
      language: true,
      learnerSources: {
        orderBy: { createdAt: "asc" },
        select: { sourceId: true },
        where: { origin: "upload" },
      },
      prompt: true,
      targetDate: true,
      title: true,
      userId: true,
    },
    where: { id: goalId },
  });

  if (!goal) {
    return null;
  }

  const { learnerSources, targetDate: _targetDate, ...rest } = goal;

  return {
    ...rest,
    referenceSyllabi: getReferenceSyllabusNeed(goal),
    uploadIds: learnerSources.map((link) => link.sourceId),
  };
}

export function toResearchPlanInput(goal: {
  details: unknown;
  kind: GoalKind;
  prompt: string;
  title: string;
  uploadIds: readonly string[];
}): { details: string; goal: string; personal: boolean } {
  const details = isJsonObject(goal.details) ? goal.details : {};
  const ownMaterial = goal.uploadIds.length > 0 || details.materialIntent === "exam";

  if (ownMaterial) {
    return {
      details: JSON.stringify(details),
      goal: `${goal.title}\n${goal.prompt}`,
      personal: true,
    };
  }

  const named =
    goal.kind === "exam" ? toExamIdentity({ details, exams: [], title: goal.title }) : goal.title;

  return { details: toSharedContext(details) ?? "none", goal: named, personal: false };
}
