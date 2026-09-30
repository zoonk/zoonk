import "server-only";
import { prisma } from "@zoonk/db";
import { getReferenceSyllabusNeed } from "../curriculum/goal-curriculum-inputs";

/** Learners still preparing for an exam: goals linked to its blueprint that are active. */
export function countActiveExamGoals(examBlueprintId: string): Promise<number> {
  return prisma.goal.count({ where: { examBlueprintId, status: "active" } });
}

/**
 * Learners who still rely on a source: an active goal linked to it directly
 * (their upload or research for their goal) or through an exam blueprint read
 * from it.
 */
export function countActiveSourceGoals(sourceId: string): Promise<number> {
  return prisma.goal.count({
    where: {
      OR: [{ learnerSources: { some: { sourceId } } }, { examBlueprint: { sourceId } }],
      status: "active",
    },
  });
}

/**
 * Points a goal at its exam's blueprint once research found or built it, so
 * the plan, the exam map and Today read the same canonical exam as everyone
 * preparing for it.
 */
export async function linkGoalToExamBlueprint({
  examBlueprintId,
  goalId,
}: {
  examBlueprintId: string;
  goalId: string;
}): Promise<boolean> {
  const { count } = await prisma.goal.updateMany({
    data: { examBlueprintId },
    where: { id: goalId },
  });

  return count > 0;
}

/** Records the sources research found for a goal that isn't an exam, such as a law or a tool's docs. */
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

/**
 * What research reads about a goal, never the learner's other data: the goal, the material the
 * learner uploaded with it (read instead of searching the web), and whether it's a learn goal
 * big enough for reference syllabi.
 */
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
