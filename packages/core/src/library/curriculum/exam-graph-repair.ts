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

/** An exam's shared content is written for the exam and read by every learner of it. */
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

/**
 * The graph with the skills the coverage check finds missing, and nothing else changed: the
 * skills it has keep their subjects and weights (the check's moves are left out), so learners'
 * plans made from it stay as they are.
 */
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

/**
 * The stored graph with the added skills where the checked graph puts them, every skill it had
 * kept as stored. An added skill identity search found already in the graph adds nothing.
 */
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

/** The skills of the checked graph that the stored one doesn't have, with no Library id yet. */
function listAddedSkills({
  checked,
  curriculum,
}: {
  checked: GoalSkillGraph;
  curriculum: PlanSkillGraph;
}): GoalSkillGraph["skills"] {
  return checked.skills.filter((skill) => curriculum.idsByKey[skill.key] === undefined);
}

/**
 * Adds to an exam's shared graph (`ExamSkillGraph`) skills for the notice's topics none of its
 * skills teaches, after an admin had the notice read again: content a new reading names that the
 * graph is missing, such as the options of a choice (a language or an elective). It's a repair,
 * never a rewrite (the reset is the only rewrite): every skill the graph has keeps its place,
 * subject and weight, and each added skill goes through identity search, so a skill the Library
 * already has is reused, never written twice. One coverage call, none when every topic has a
 * skill. Learners' plans made before it bring a choice's option in from here once they pick it.
 * Returns the added skills' names.
 */
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

  // Plans of the exam add a picked option's skills from the shared graph.
  await writePlanInputs(async (tx) => {
    await lockPlanBlueprintWrite(tx, examBlueprintId);
    await tx.examSkillGraph.update({ data: { graph }, where: { examBlueprintId } });
  });

  return added.map((skill) => skill.name);
}
