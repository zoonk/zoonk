import "server-only";
import { isDeepStrictEqual } from "node:util";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { checkCoverage } from "@zoonk/ai/tasks/curriculum/coverage-check";
import { findUncoveredTopics, formatExamOutline } from "@zoonk/ai/tasks/curriculum/exam-outline";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { joinOptionSkills } from "../../plans/planner/option-skills";
import { type PlanGraph, parsePlanGraph } from "../../plans/planner/plan-state";
import { lockPlanBlueprintWrite, writePlanInputs } from "../_utils/plan-input-write";
import { toGoalCandidateExams } from "../exams/candidate-exams";
import { applyGraphCoverage } from "./add-coverage-skills";
import { type CurriculumScope } from "./curriculum-scope";
import { toExamOutline } from "./exam-curriculum-outline";
import { toGoalPlanGraph } from "./goal-plan-graph";
import { type PlanSkillGraph, buildPlanSkillGraph } from "./plan-skill-graph";
import { noticeSubjects } from "./prune-notice-skills";
import { prunePlanNoticeGraph } from "./prune-plan-notice-graph";
import {
  type GoalSkillGraph,
  linkGoalSkillPrerequisites,
  saveGoalSkills,
} from "./save-goal-skills";
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

async function addCoverage({
  blueprint,
  curriculum,
  scope,
}: {
  blueprint: ExamBlueprint;
  curriculum: PlanSkillGraph;
  scope: CurriculumScope;
}) {
  const outline = toExamOutline(blueprint);

  const coverage = await checkCoverage({
    analytics: { contentScope: "shared" },
    courses: curriculum.graph.courses.map(({ key, title }) => ({ key, title })),
    examOutline: outline,
    goal: scope.generalGoal ?? blueprint.name,
    goalKind: "exam",
    language: blueprint.language,
    references: [{ text: formatExamOutline(outline), title: blueprint.name }],
    serviceTier: chooseServiceTier({ wait: "later" }),
    skills: curriculum.graph.skills.map(({ area, description, examWeight, key, name, topics }) => ({
      area,
      description,
      examWeight,
      key,
      name,
      topics,
    })),
  });

  const { graph } = applyGraphCoverage({
    coverage: { ...coverage.data, examWeights: [], placements: [] },
    graph: curriculum.graph,
    outline,
  });

  return { graph, provenance: coverage.provenance };
}

function insertAddedSkills({ added, stored }: { added: PlanGraph; stored: PlanGraph }): PlanGraph {
  const kept = new Map(stored.skills.map((skill) => [skill.skillId, skill]));
  const skills = added.skills.map((skill) => kept.get(skill.skillId) ?? skill);
  const isComplete = stored.skills.every((skill) => skills.includes(skill));

  return {
    ...stored,
    skills: isComplete
      ? skills
      : [...stored.skills, ...skills.filter((skill) => !kept.has(skill.skillId))],
  };
}

function listAddedSkills({
  checked,
  curriculum,
}: {
  checked: GoalSkillGraph;
  curriculum: PlanSkillGraph;
}): GoalSkillGraph["skills"] {
  return checked.skills.filter((skill) => curriculum.idsByKey[skill.key] === undefined);
}

export async function addMissingExamGraphSkills(examBlueprintId: string): Promise<string[]> {
  const [stored, blueprint] = await Promise.all([
    prisma.examSkillGraph.findUnique({ where: { examBlueprintId } }),
    prisma.examBlueprint.findUnique({ where: { id: examBlueprintId } }),
  ]);

  const curriculum =
    stored &&
    (await buildPlanSkillGraph({
      graph: stored.graph,
      plannedAt: stored.generatedAt,
      provenance: {
        generatedAt: stored.generatedAt.toISOString(),
        model: stored.model,
        promptVersion: stored.promptVersion,
        runId: stored.runId,
      },
    }));

  if (!stored || !blueprint || !curriculum) {
    return [];
  }

  const uncovered = findUncoveredTopics({
    outline: toExamOutline(blueprint),
    skills: curriculum.graph.skills,
  });

  if (uncovered.length === 0) {
    return [];
  }

  const scope = toExamScope(blueprint);
  const checked = await addCoverage({ blueprint, curriculum, scope });
  const added = listAddedSkills({ checked: checked.graph, curriculum });

  if (added.length === 0) {
    return [];
  }

  const ids = await saveGoalSkills({
    analytics: { contentScope: "shared" },
    courses: checked.graph.courses,
    provenance: checked.provenance,
    scope,
    skills: added,
  });

  const idsByKey = { ...curriculum.idsByKey, ...ids };
  await linkGoalSkillPrerequisites({ idsByKey, skills: added });

  const graph = insertAddedSkills({
    added: toGoalPlanGraph({
      courseIdsByKey: curriculum.courseIdsByKey,
      graph: checked.graph,
      idsByKey,
    }),
    stored: parsePlanGraph(stored.graph),
  });

  const saved = await writePlanInputs(async (tx) => {
    await lockPlanBlueprintWrite(tx, examBlueprintId);
    const current = await tx.examSkillGraph.findUnique({ where: { examBlueprintId } });

    if (!current || !isDeepStrictEqual(current.graph, stored.graph)) {
      return false;
    }

    const currentBlueprint = await tx.examBlueprint.findUniqueOrThrow({
      where: { id: examBlueprintId },
    });

    const pruned = await prunePlanNoticeGraph({
      db: tx,
      graph,
      subjects: toExamOutline(currentBlueprint).subjects,
    });

    await tx.examSkillGraph.update({ data: { graph: pruned.graph }, where: { examBlueprintId } });
    return true;
  });

  return saved ? added.map((skill) => skill.name) : [];
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
