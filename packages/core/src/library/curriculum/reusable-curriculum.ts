import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { type CurriculumScope } from "./curriculum-scope";
import { type GoalCurriculumInputs } from "./goal-curriculum-inputs";
import { type PlanSkillGraph, buildPlanSkillGraph } from "./plan-skill-graph";
import { isSharedExamGraph } from "./shared-graph-prompt";

/** An exam's shared curriculum, with the course a plan made from it opens with. */
export type ReusableCurriculum = PlanSkillGraph & { primaryCourseId: string | null };

type SharedInputs = Parameters<typeof isSharedExamGraph>[0]["inputs"] & {
  goal: Pick<GoalCurriculumInputs["goal"], "examBlueprintId" | "id" | "language">;
};

/**
 * How many follow-up questions the learner answered: their answers shape a skill graph beyond the
 * notice, which a graph written for someone else wouldn't read. The level they gave doesn't: an
 * exam's shared graph is written without it (`toScopedGraphPrompt`).
 */
function countFollowUps(details: unknown): number {
  const values = isJsonObject(details) ? details : {};
  return Array.isArray(values.followUps) ? values.followUps.length : 0;
}

/** Whether every course of a stored graph is shared: a private course's graph is its owner's. */
async function hasOnlySharedCourses(courseIds: readonly string[]): Promise<boolean> {
  const privateCourses = await prisma.course.count({
    where: { id: { in: [...courseIds] }, visibility: "private" },
  });

  return courseIds.length > 0 && privateCourses === 0;
}

/**
 * The exam whose shared graph this goal's is: an exam goal of a shared scope (see
 * `isSharedExamGraph`) on a notice research linked, in the notice's language, whose learner
 * answered no follow-ups (those shape a graph for them alone). Null otherwise.
 */
async function findSharedExam({
  inputs,
  scope,
}: {
  inputs: SharedInputs;
  scope: CurriculumScope;
}): Promise<string | null> {
  const { examBlueprintId, id, language } = inputs.goal;

  if (!isSharedExamGraph({ inputs, scope }) || !examBlueprintId) {
    return null;
  }

  const [goal, blueprint] = await Promise.all([
    prisma.goal.findUnique({ select: { details: true }, where: { id } }),
    prisma.examBlueprint.findUnique({ select: { language: true }, where: { id: examBlueprintId } }),
  ]);

  if (blueprint?.language !== language || countFollowUps(goal?.details) > 0) {
    return null;
  }

  return examBlueprintId;
}

/**
 * Keeps a goal's freshly written graph as its exam's shared graph (`ExamSkillGraph`), when the goal's
 * graph is the exam's (`findSharedExam`): the first one written for the exam stays, whoever's run
 * wrote it, and only that same run can complete it (its reading of the notice adding skills).
 * Learners' plans keep their own copies; this one is the exam's, so deleting every learner of the
 * exam never loses it, and only an admin resets it (`resetExamSkillGraphForAdmin`, in `exam-skill-graph-reset`).
 *
 * This is a workflow bridge: the goal comes from the run its learner's request started.
 */
export async function saveExamSkillGraph({
  graph,
  inputs,
  provenance,
  scope,
}: {
  graph: PlanGraph;
  inputs: SharedInputs;
  provenance: { generatedAt: Date; model: string; promptVersion: string; runId: string };
  scope: CurriculumScope;
}): Promise<void> {
  const examBlueprintId = await findSharedExam({ inputs, scope });

  if (!examBlueprintId || graph.skills.length === 0) {
    return;
  }

  const goal = await prisma.goal.findUnique({
    select: { primaryCourseId: true },
    where: { id: inputs.goal.id },
  });

  const data = { graph, primaryCourseId: goal?.primaryCourseId ?? null, ...provenance };

  const { count } = await prisma.examSkillGraph.createMany({
    data: [{ ...data, examBlueprintId }],
    skipDuplicates: true,
  });

  if (count === 0) {
    await prisma.examSkillGraph.updateMany({
      data,
      where: { examBlueprintId, runId: provenance.runId },
    });
  }
}

/**
 * The exam's shared curriculum (`ExamSkillGraph`) for a goal whose graph is the exam's
 * (`findSharedExam`), to plan from instead of writing a skill graph again, whatever prompt version
 * wrote it: a prompt change never rewrites an exam's graph on its own, only an admin's reset does.
 * Its skills and courses are already in the Library, outlined and often written, so the plan,
 * placement's questions and the first lessons come in seconds, at no cost. Whatever level either
 * learner gave, which decides where each starts, not the graph. Null when the exam has none, or
 * one in a private course.
 *
 * This is a workflow bridge: the goal comes from the run its learner's request started.
 */
export async function findReusableCurriculum({
  inputs,
  scope,
}: {
  inputs: SharedInputs;
  scope: CurriculumScope;
}): Promise<ReusableCurriculum | null> {
  const examBlueprintId = await findSharedExam({ inputs, scope });

  const stored = examBlueprintId
    ? await prisma.examSkillGraph.findUnique({ where: { examBlueprintId } })
    : null;

  if (!stored) {
    return null;
  }

  const curriculum = await buildPlanSkillGraph({
    graph: stored.graph,
    plannedAt: stored.generatedAt,
    provenance: {
      generatedAt: stored.generatedAt.toISOString(),
      model: stored.model,
      promptVersion: stored.promptVersion,
      runId: stored.runId,
    },
  });

  if (!curriculum || !(await hasOnlySharedCourses(Object.values(curriculum.courseIdsByKey)))) {
    return null;
  }

  return { ...curriculum, primaryCourseId: stored.primaryCourseId };
}
