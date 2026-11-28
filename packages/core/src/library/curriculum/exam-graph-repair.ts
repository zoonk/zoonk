import "server-only";
import { isDeepStrictEqual } from "node:util";
import { findUncoveredTopics } from "@zoonk/ai/tasks/curriculum/exam-outline";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { joinOptionSkills } from "../../plans/planner/option-skills";
import { type PlanGraph, parsePlanGraph } from "../../plans/planner/plan-state";
import { lockPlanBlueprintWrite, writePlanInputs } from "../_utils/plan-input-write";
import { toGoalCandidateExams } from "../exams/candidate-exams";
import { type CurriculumScope } from "./curriculum-scope";
import { toExamOutline } from "./exam-curriculum-outline";
import { listMissingNoticeSubjects } from "./notice-graph-sections";
import { buildPlanSkillGraph } from "./plan-skill-graph";
import { noticeSubjects } from "./prune-notice-skills";
import { prunePlanNoticeGraph } from "./prune-plan-notice-graph";
import { toExamIdentity } from "./shared-graph-prompt";

function toExamScope(blueprint: ExamBlueprint): CurriculumScope {
  const exams = toGoalCandidateExams({ blueprint, kind: "exam" });

  return {
    country: blueprint.country,
    exams,
    generalGoal: toExamIdentity({ details: {}, exams }) ?? blueprint.name,
    language: blueprint.language,
    ownerId: null,
    targetLanguage: null,
  };
}

export async function loadExamGraphReconcile(examBlueprintId: string) {
  const [stored, blueprint] = await Promise.all([
    prisma.examSkillGraph.findUnique({ where: { examBlueprintId } }),
    prisma.examBlueprint.findUnique({ where: { id: examBlueprintId } }),
  ]);

  if (!stored || !blueprint || blueprint.ownerId) {
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

  if (!curriculum) {
    return null;
  }

  const outline = toExamOutline(blueprint);
  const uncovered = findUncoveredTopics({ outline, skills: curriculum.graph.skills });
  const absent = listMissingNoticeSubjects({ graph: curriculum.graph, outline });

  return uncovered.length > 0 || absent.length > 0
    ? {
        curriculum,
        outline,
        scope: toExamScope(blueprint),
        storedGraph: stored.graph,
        structure: blueprint.structure,
      }
    : null;
}

type ExamGraphReconcile = NonNullable<Awaited<ReturnType<typeof loadExamGraphReconcile>>>;

export function saveReconciledExamGraph({
  examBlueprintId,
  graph,
  storedGraph,
  structure,
}: Pick<ExamGraphReconcile, "storedGraph" | "structure"> & {
  examBlueprintId: string;
  graph: PlanGraph;
}): Promise<boolean> {
  return writePlanInputs(async (tx) => {
    await lockPlanBlueprintWrite(tx, examBlueprintId);

    const [current, blueprint] = await Promise.all([
      tx.examSkillGraph.findUnique({ select: { graph: true }, where: { examBlueprintId } }),
      tx.examBlueprint.findUnique({ where: { id: examBlueprintId } }),
    ]);

    if (
      !current ||
      !blueprint ||
      !isDeepStrictEqual(current.graph, storedGraph) ||
      !isDeepStrictEqual(blueprint.structure, structure)
    ) {
      return false;
    }

    const pruned = await prunePlanNoticeGraph({
      db: tx,
      graph,
      subjects: toExamOutline(blueprint).subjects,
    });

    if (!isDeepStrictEqual(parsePlanGraph(current.graph), pruned.graph)) {
      await tx.examSkillGraph.update({ data: { graph: pruned.graph }, where: { examBlueprintId } });
    }

    return true;
  });
}

type NoticeSubjects = ReturnType<typeof noticeSubjects>;

function toNoticeRepair({ graph, subjects }: { graph: PlanGraph; subjects: NoticeSubjects }) {
  return { extraSkills: graph.extraSkills ?? [], skills: joinOptionSkills(graph).skills, subjects };
}

export async function prepareNoticeGraphRepair(examBlueprintId: string) {
  const [stored, blueprint] = await Promise.all([
    prisma.examSkillGraph.findUnique({ select: { graph: true }, where: { examBlueprintId } }),
    prisma.examBlueprint.findUnique({
      select: { structure: true },
      where: { id: examBlueprintId },
    }),
  ]);

  if (!blueprint) {
    return null;
  }

  const graph = parsePlanGraph(stored?.graph);
  const subjects = noticeSubjects(blueprint.structure);
  const { dropped } = await prunePlanNoticeGraph({ graph, subjects });

  if (dropped.length === 0) {
    return toNoticeRepair({ graph, subjects });
  }

  return writePlanInputs(async (tx) => {
    await lockPlanBlueprintWrite(tx, examBlueprintId);

    const [current, notice] = await Promise.all([
      tx.examSkillGraph.findUnique({ select: { graph: true }, where: { examBlueprintId } }),
      tx.examBlueprint.findUnique({ select: { structure: true }, where: { id: examBlueprintId } }),
    ]);

    if (!notice) {
      return null;
    }

    const currentSubjects = noticeSubjects(notice.structure);

    const pruned = await prunePlanNoticeGraph({
      db: tx,
      graph: parsePlanGraph(current?.graph),
      subjects: currentSubjects,
    });

    if (pruned.dropped.length > 0) {
      await tx.examSkillGraph.update({ data: { graph: pruned.graph }, where: { examBlueprintId } });
    }

    return toNoticeRepair({ graph: pruned.graph, subjects: currentSubjects });
  });
}
