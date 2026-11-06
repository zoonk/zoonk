import "server-only";
import { type Goal, type GoalKind, type Plan, type TransactionClient, prisma } from "@zoonk/db";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { findNamedChoices } from "../../exams/choices/named-exam-choices";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { getPlanState } from "../../plans/_utils/plan-context";
import { applyPlanOperations } from "../../plans/planner/plan-operations";
import { getReferenceSyllabusNeed } from "../curriculum/goal-curriculum-inputs";
import { toExamIdentity, toSharedContext } from "../curriculum/shared-graph-prompt";
import { courseFollowersFilter } from "../products/course-release";
import { type ExamStructure, examStructureSchema } from "./blueprint-contract";
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

/** A product's page counts the goals about its product and the learners of its main courses. */
export async function countActiveSourceGoals(sourceId: string): Promise<number> {
  const mainCourses = await prisma.course.findMany({
    select: { id: true },
    where: {
      isPinned: false,
      product: { OR: [{ releasesSourceId: sourceId }, { sources: { some: { id: sourceId } } }] },
      userId: null,
    },
  });

  return prisma.goal.count({
    where: {
      OR: [
        { learnerSources: { some: { sourceId } } },
        { examBlueprint: { sourceId } },
        { product: { sources: { some: { id: sourceId } } } },
        ...mainCourses.flatMap((course) => courseFollowersFilter(course.id).OR),
      ],
      status: "active",
    },
  });
}

async function saveNamedChoices(
  tx: TransactionClient,
  { goal, structure }: { goal: Goal & { plan: Plan | null }; structure: ExamStructure | undefined },
): Promise<boolean> {
  const { plan } = goal;

  if (!plan || !structure || goal.kind !== "exam") {
    return false;
  }

  const state = getPlanState({ goal, plan });
  const named = findNamedChoices({ goal, picks: state.settings, structure });

  if (named.length === 0) {
    return false;
  }

  const applied = applyPlanOperations({
    goalKind: goal.kind,
    operations: named.map((choice) => ({ kind: "setExamChoice" as const, ...choice })),
    state,
    today: new Date(),
  });

  if ("error" in applied) {
    return false;
  }

  await tx.plan.update({ data: { settings: applied.state.settings }, where: { id: plan.id } });
  return true;
}

/** Also takes the options of the notice's choices that the learner's stated position or answers name. */
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
  const structure = examStructureSchema.safeParse(blueprint?.structure).data;

  const goal = await prisma.goal.findUnique({ where: { id: goalId } });

  if (!goal) {
    return false;
  }

  return writeLearnerChange(
    { goalIds: [goalId], planInputs: true, userId: goal.userId },
    async (tx) => {
      const current = await tx.goal.findUnique({ include: { plan: true }, where: { id: goalId } });

      if (!current) {
        return unchanged(false);
      }

      const language =
        current.kind === "exam" && targetLanguage ? targetLanguage : current.targetLanguage;

      const linked =
        current.examBlueprintId !== examBlueprintId || current.targetLanguage !== language;

      if (linked) {
        await tx.goal.update({
          data: { examBlueprintId, targetLanguage: language },
          where: { id: goalId },
        });
      }

      const picked = await saveNamedChoices(tx, { goal: current, structure });
      return linked || picked ? true : unchanged(true);
    },
  );
}

export async function unlinkGoalFromSharedExam(goalId: string): Promise<void> {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });

  if (!goal) {
    return;
  }

  await writeLearnerChange(
    { goalIds: [goalId], planInputs: true, userId: goal.userId },
    async (tx) => {
      const updated = await tx.goal.updateMany({
        data: { examBlueprintId: null },
        where: { examBlueprint: { is: { visibility: "public" } }, id: goalId },
      });

      if (updated.count === 0) {
        return unchanged(null);
      }
    },
  );
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

/** The position decides which notice research reads; the plan's own call keeps it from providers that train. */
function toResearchedExam({ details, title }: { details: unknown; title: string }): string {
  const name = toExamIdentity({ details, exams: [] });
  const position = getString(details, "targetPosition")?.trim();

  return name && position ? `${name}, ${position}` : (name ?? title);
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

  return {
    details: toSharedContext(details) ?? "none",
    goal: goal.kind === "exam" ? toResearchedExam({ details, title: goal.title }) : goal.title,
    personal: false,
  };
}
