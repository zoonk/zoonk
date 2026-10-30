import "server-only";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { type LanguageSkillGraph, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { normalizeString } from "@zoonk/utils/string";
import { loadCourseExam } from "../../goals/_utils/course-exam";
import { loadCourseOutline } from "../../goals/_utils/course-outline";
import { getExamCourseSkills } from "../../goals/_utils/exam-course-skills";
import { joinOptionSkills } from "../../plans/planner/option-skills";
import { type PlanGraph, parsePlanGraph } from "../../plans/planner/plan-state";
import { lockPlanBlueprintWrite, writePlanInputs } from "../_utils/plan-input-write";
import { pinPlanGraphToCourse } from "./course-start-graph";
import { type CurriculumScope } from "./curriculum-scope";
import { type GoalCurriculumInputs } from "./goal-curriculum-inputs";
import { type PlanSkillGraph, buildPlanSkillGraph } from "./plan-skill-graph";
import { isSharedExamGraph } from "./shared-graph-prompt";

export type ReusableCurriculum = PlanSkillGraph & { primaryCourseId: string | null };

type SharedInputs = Parameters<typeof isSharedExamGraph>[0]["inputs"] & {
  goal: Pick<GoalCurriculumInputs["goal"], "examBlueprintId" | "id" | "language">;
};

function countFollowUps(details: unknown): number {
  const values = isJsonObject(details) ? details : {};
  return Array.isArray(values.followUps) ? values.followUps.length : 0;
}

async function hasOnlySharedCourses(courseIds: readonly string[]): Promise<boolean> {
  const privateCourses = await prisma.course.count({
    where: { id: { in: [...courseIds] }, visibility: "private" },
  });

  return courseIds.length > 0 && privateCourses === 0;
}

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

/** Internal workflow bridge: the goal must come from the learner's authorized run. */
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

  const kept = { primaryCourseId: goal?.primaryCourseId ?? null, ...provenance };
  const current = { examBlueprintId, runId: provenance.runId };

  const stored = await prisma.examSkillGraph.findUnique({
    select: { graph: true, runId: true },
    where: { examBlueprintId },
  });

  if (stored && stored.runId !== provenance.runId) {
    return;
  }

  if (stored && isDeepStrictEqual(parsePlanGraph(stored.graph), parsePlanGraph(graph))) {
    await prisma.examSkillGraph.updateMany({ data: kept, where: current });
    return;
  }

  await writePlanInputs(async (tx) => {
    await lockPlanBlueprintWrite(tx, examBlueprintId);

    const { count } = await tx.examSkillGraph.createMany({
      data: [{ ...kept, examBlueprintId, graph }],
      skipDuplicates: true,
    });

    if (count === 0) {
      await tx.examSkillGraph.updateMany({ data: { ...kept, graph }, where: current });
    }
  });
}

async function findReusableExam({
  inputs,
  scope,
}: {
  inputs: SharedInputs;
  scope: CurriculumScope;
}): Promise<string | null> {
  const { startedCourse } = inputs;

  const examBlueprintId = await findSharedExam({
    inputs: { ...inputs, startedCourse: null },
    scope,
  });

  if (!examBlueprintId || !startedCourse) {
    return examBlueprintId;
  }

  const exam = startedCourse.ownerId === null ? await loadCourseExam(startedCourse.id) : null;
  return exam?.blueprint.id === examBlueprintId ? examBlueprintId : null;
}

/** The same typed goal and shared answers share a language graph, whatever title the goal got. */
function findLanguageGraphKey({
  inputs,
  scope,
}: {
  inputs: SharedInputs;
  scope: CurriculumScope;
}): string | null {
  if (
    inputs.goal.kind !== "language" ||
    scope.ownerId !== null ||
    inputs.hasMaterial ||
    inputs.startedCourse
  ) {
    return null;
  }

  const { language, prompt, targetLanguage } = inputs.goal;
  const answers = [language, targetLanguage, normalizeString(prompt), inputs.sharedContext ?? null];

  return createHash("sha256").update(JSON.stringify(answers)).digest("hex");
}

type StoredGraph = Pick<
  LanguageSkillGraph,
  "generatedAt" | "graph" | "model" | "primaryCourseId" | "promptVersion" | "runId"
>;

async function findStoredGraph({
  inputs,
  scope,
}: {
  inputs: SharedInputs;
  scope: CurriculumScope;
}): Promise<StoredGraph | null> {
  const examBlueprintId = await findReusableExam({ inputs, scope });

  if (examBlueprintId) {
    return prisma.examSkillGraph.findUnique({ where: { examBlueprintId } });
  }

  const promptKey = findLanguageGraphKey({ inputs, scope });
  return promptKey ? prisma.languageSkillGraph.findUnique({ where: { promptKey } }) : null;
}

async function toReusableCurriculum({
  inputs,
  stored,
}: {
  inputs: SharedInputs;
  stored: StoredGraph;
}): Promise<ReusableCurriculum | null> {
  const { startedCourse } = inputs;
  const graph = parsePlanGraph(stored.graph);
  const courseIds = joinOptionSkills(graph).skills.flatMap((skill) => skill.courseIds ?? []);

  const course = startedCourse && {
    ...startedCourse,
    ...(await prisma.course.findUniqueOrThrow({
      select: { format: true },
      where: { id: startedCourse.id },
    })),
  };

  const teachesNothing = course && getExamCourseSkills({ course, examGraph: graph }).length === 0;

  if (teachesNothing || !(await hasOnlySharedCourses([...new Set(courseIds)]))) {
    return null;
  }

  const curriculum = await buildPlanSkillGraph({
    graph: course
      ? pinPlanGraphToCourse({
          chapters: await loadCourseOutline({ courseId: course.id, userId: null }),
          course,
          graph,
        })
      : graph,
    plannedAt: stored.generatedAt,
    provenance: {
      generatedAt: stored.generatedAt.toISOString(),
      model: stored.model,
      promptVersion: stored.promptVersion,
      runId: stored.runId,
    },
  });

  return curriculum
    ? { ...curriculum, primaryCourseId: startedCourse?.id ?? stored.primaryCourseId }
    : null;
}

/** Internal workflow bridge: the goal must come from the learner's authorized run. */
export async function findReusableCurriculum({
  inputs,
  scope,
}: {
  inputs: SharedInputs;
  scope: CurriculumScope;
}): Promise<ReusableCurriculum | null> {
  const stored = await findStoredGraph({ inputs, scope });
  return stored ? toReusableCurriculum({ inputs, stored }) : null;
}

/**
 * Internal workflow bridge: the goal must come from the learner's authorized run. Keeps the graph
 * this run built for a shared language goal, or returns the one a goal with the same answers kept
 * first, for this goal to plan from instead.
 */
export async function claimLanguageSkillGraph({
  graph,
  inputs,
  provenance,
  scope,
}: {
  graph: PlanGraph;
  inputs: SharedInputs;
  provenance: { generatedAt: Date; model: string; promptVersion: string; runId: string };
  scope: CurriculumScope;
}): Promise<ReusableCurriculum | null> {
  const promptKey = findLanguageGraphKey({ inputs, scope });

  if (!promptKey || graph.skills.length === 0) {
    return null;
  }

  const goal = await prisma.goal.findUnique({
    select: { primaryCourseId: true },
    where: { id: inputs.goal.id },
  });

  await prisma.languageSkillGraph.createMany({
    data: [{ ...provenance, graph, primaryCourseId: goal?.primaryCourseId ?? null, promptKey }],
    skipDuplicates: true,
  });

  const stored = await prisma.languageSkillGraph.findUniqueOrThrow({ where: { promptKey } });
  return stored.runId === provenance.runId ? null : toReusableCurriculum({ inputs, stored });
}
