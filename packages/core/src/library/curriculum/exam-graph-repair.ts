import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { checkCoverage } from "@zoonk/ai/tasks/v2/curriculum/coverage-check";
import { findUncoveredTopics, formatExamOutline } from "@zoonk/ai/tasks/v2/curriculum/exam-outline";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { type PlanGraph, parsePlanGraph } from "../../plans/planner/plan-state";
import { lockPlanBlueprintWrite, writePlanInputs } from "../_utils/plan-input-write";
import { toGoalCandidateExams } from "../exams/candidate-exams";
import { applyGraphCoverage } from "./add-coverage-skills";
import { type CurriculumScope } from "./curriculum-scope";
import { toExamOutline } from "./goal-curriculum-inputs";
import { toGoalPlanGraph } from "./goal-plan-graph";
import { type PlanSkillGraph, buildPlanSkillGraph } from "./plan-skill-graph";
import {
  type GoalSkillGraph,
  linkGoalSkillPrerequisites,
  saveGoalSkills,
} from "./save-goal-skills";
import { toExamIdentity } from "./shared-graph-prompt";

function toExamScope(blueprint: ExamBlueprint): CurriculumScope {
  const exams = toGoalCandidateExams({ blueprint, kind: "exam" });

  return {
    exams,
    generalGoal: toExamIdentity({ details: {}, exams, title: blueprint.name }),
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
    phases: stored.phases,
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

  await writePlanInputs(async (tx) => {
    await lockPlanBlueprintWrite(tx, examBlueprintId);
    await tx.examSkillGraph.update({ data: { graph }, where: { examBlueprintId } });
  });

  return added.map((skill) => skill.name);
}
