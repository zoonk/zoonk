import "server-only";
import { type generateSkillGraph } from "@zoonk/ai/tasks/v2/curriculum/skill-graph";
import { type LibraryProvenance } from "../_utils/library-rows";
import { setSkillPrerequisites } from "../skills/create-skill";
import { type CurriculumAnalytics, type CurriculumScope } from "./curriculum-scope";
import { resolveScopeSkills } from "./resolve-lesson-skills";

export type GoalSkillGraph = Awaited<ReturnType<typeof generateSkillGraph>>["data"];
type GraphSkill = GoalSkillGraph["skills"][number];

/** Internal workflow bridge: the owner must come from the goal the public boundary authorized. */
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

export async function linkGoalSkillPrerequisites({
  idsByKey,
  skills,
}: {
  idsByKey: Readonly<Record<string, string>>;
  skills: readonly Pick<GraphSkill, "key" | "prerequisites">[];
}): Promise<void> {
  const among = new Set(Object.values(idsByKey).filter(Boolean));

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
