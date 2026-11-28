import { checkCoverage } from "@zoonk/ai/tasks/curriculum/coverage-check";
import { applyGraphCoverage } from "../add-coverage-skills";
import { loadExamGraphReconcile, saveReconciledExamGraph } from "../exam-graph-repair";
import { toGoalPlanGraph } from "../goal-plan-graph";
import { linkGoalSkillPrerequisites, saveGoalSkills } from "../save-goal-skills";

export async function addCoveredExamSkills(examBlueprintId: string): Promise<string[]> {
  const snapshot = await loadExamGraphReconcile(examBlueprintId);

  if (!snapshot) {
    return [];
  }

  const { curriculum, outline, scope, storedGraph, structure } = snapshot;

  const { data, provenance } = await checkCoverage({
    courses: curriculum.graph.courses,
    examOutline: outline,
    goal: outline.name,
    goalKind: "exam",
    language: scope.language,
    references: [],
    skills: curriculum.graph.skills,
  });

  const { graph } = applyGraphCoverage({
    coverage: { ...data, examWeights: [], placements: [] },
    graph: curriculum.graph,
    outline,
  });

  const skills = graph.skills.filter((skill) => !curriculum.idsByKey[skill.key]);
  const ids = await saveGoalSkills({ courses: graph.courses, provenance, scope, skills });
  const idsByKey = { ...curriculum.idsByKey, ...ids };

  await linkGoalSkillPrerequisites({ idsByKey, skills });

  const saved = await saveReconciledExamGraph({
    examBlueprintId,
    graph: toGoalPlanGraph({ courseIdsByKey: curriculum.courseIdsByKey, graph, idsByKey }),
    storedGraph,
    structure,
  });

  return saved ? skills.map((skill) => skill.name) : [];
}
