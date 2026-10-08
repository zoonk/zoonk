import "server-only";
import { type generateSkillGraph } from "@zoonk/ai/tasks/v2/curriculum/skill-graph";
import { type LibraryProvenance } from "../_utils/library-rows";
import { addSkillPrerequisites } from "../skills/create-skill";
import { type CurriculumAnalytics, type CurriculumScope } from "./curriculum-scope";
import { resolveScopeSkills } from "./resolve-lesson-skills";

export type GoalSkillGraph = Awaited<ReturnType<typeof generateSkillGraph>>["data"];
type GraphSkill = GoalSkillGraph["skills"][number];

/**
 * Puts a slice of a goal's skill graph in the Library and returns each graph key's skill id. The
 * slice's skills resolve together (see `resolveScopeSkills`), each within its area, so an exam's
 * English reading skill never becomes its Portuguese one. Workflows call it in slices so every
 * step stays short; a retried slice finds the skills it already created by their identity keys.
 *
 * This is a workflow bridge: the scope's owner comes from the goal the public boundary loaded.
 */
export async function saveGoalSkills({
  analytics,
  provenance,
  scope,
  skills,
}: {
  analytics?: CurriculumAnalytics;
  provenance: LibraryProvenance;
  scope: CurriculumScope;
  skills: readonly GraphSkill[];
}): Promise<Record<string, string>> {
  const ids = await resolveScopeSkills({
    analytics,
    provenance,
    scope,
    skills: skills.map((skill) => ({ ...skill, course: skill.area })),
  });

  return Object.fromEntries(skills.map((skill, index) => [skill.key, ids[index] ?? ""]));
}

/**
 * Records the graph's prerequisite edges between Library skills, so the planner and placement
 * read the same order on every goal that shares them. Edges already stored are kept.
 */
export async function linkGoalSkillPrerequisites({
  idsByKey,
  skills,
}: {
  idsByKey: Readonly<Record<string, string>>;
  skills: readonly Pick<GraphSkill, "key" | "prerequisites">[];
}): Promise<void> {
  const edges = skills.flatMap((skill) => {
    const skillId = idsByKey[skill.key];
    const prerequisiteIds = skill.prerequisites.flatMap((key) => idsByKey[key] ?? []);

    return skillId && prerequisiteIds.length > 0 ? [{ prerequisiteIds, skillId }] : [];
  });

  await Promise.all(edges.map((edge) => addSkillPrerequisites(edge)));
}
