import "server-only";
import { type GoalKind, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getReferenceSyllabusNeed } from "../curriculum/goal-curriculum-inputs";
import { toExamIdentity, toSharedContext } from "../curriculum/shared-graph-prompt";
import { readTestedLanguage } from "./blueprint-language";

/** Learners still preparing for an exam: goals linked to its blueprint that are active. */
export function countActiveExamGoals(examBlueprintId: string): Promise<number> {
  return prisma.goal.count({ where: { examBlueprintId, status: "active" } });
}

/**
 * Learners preparing for a later edition of an exam than the stored notice's: active goals whose
 * date is after its exam.
 */
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
 * preparing for it. An exam goal also learns the language the notice says the
 * exam tests (PTE Academic: English), whatever the exam is called.
 */
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

  const { count } = await prisma.goal.updateMany({
    data: { examBlueprintId },
    where: { id: goalId },
  });

  if (count > 0 && targetLanguage) {
    await prisma.goal.updateMany({ data: { targetLanguage }, where: { id: goalId, kind: "exam" } });
  }

  return count > 0;
}

/**
 * Takes a goal off the shared notice onboarding matched by its name once research finds the exam
 * is a test only the learner's material describes (a class test), so its plan and Today follow
 * that material instead of a public exam's checklist and rules. A private blueprint stays.
 */
export async function unlinkGoalFromSharedExam(goalId: string): Promise<void> {
  await prisma.goal.updateMany({
    data: { examBlueprintId: null },
    where: { examBlueprint: { is: { visibility: "public" } }, id: goalId },
  });
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

/**
 * What the research plan reads about a goal. The plan names the exam (or law, product or
 * subject), whose identity, official sources and searches every learner of it shares, so it reads
 * the exam onboarding understood (`toExamIdentity`), or another goal's title, and the details
 * naming it (`toSharedContext`), never the learner's own words or target. A goal from the
 * learner's own material (an upload, their class test) is theirs alone and keeps what they wrote,
 * so its plan is `personal`: never sent where providers may train on it.
 */
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
