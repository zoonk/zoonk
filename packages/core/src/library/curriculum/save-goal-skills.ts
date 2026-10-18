import "server-only";
import { type generateSkillGraph } from "@zoonk/ai/tasks/v2/curriculum/skill-graph";
import { type LibraryProvenance } from "../_utils/library-rows";
import { setSkillPrerequisites } from "../skills/create-skill";
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
 * read the same order on every goal that shares them. The newest graph decides the edges between
 * its own skills: one an older graph drew between two of them that this graph doesn't is
 * removed, since a plan short on time teaches every prerequisite of a topic it keeps (an ENEM
 * graph once put ecology behind tissues and the classification of living beings, and every goal
 * sharing those skills paid for them). Edges to skills outside the graph are kept.
 */
export async function linkGoalSkillPrerequisites({
  idsByKey,
  skills,
}: {
  idsByKey: Readonly<Record<string, string>>;
  skills: readonly Pick<GraphSkill, "key" | "prerequisites">[];
}): Promise<void> {
  const among = new Set(Object.values(idsByKey).filter(Boolean));

  // A skill learned in several courses has a key for each: it needs what any of them lists.
  const listed = skills.reduce((bySkill, skill) => {
    const skillId = idsByKey[skill.key];

    if (!skillId) {
      return bySkill;
    }

    const prerequisiteIds = skill.prerequisites.flatMap((key) => idsByKey[key] ?? []);
    return bySkill.set(skillId, [...(bySkill.get(skillId) ?? []), ...prerequisiteIds]);
  }, new Map<string, string[]>());

  await Promise.all(
    [...listed].map(([skillId, prerequisiteIds]) =>
      setSkillPrerequisites({ among, prerequisiteIds, skillId }),
    ),
  );
}
