import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { type BuiltCurriculum, toSlices } from "./goal-curriculum";
import { type GoalRunContext } from "./goal-run-context";
import { linkSkillPrerequisitesStep, saveGoalSkillsStep } from "./steps/goal-curriculum-steps";
import { mergeSkillTwinsStep } from "./steps/skill-twins-step";

/** The skills the check added to the saved graph: those with no Library id yet. */
function listAddedKeys({
  curriculum,
  graph,
}: {
  curriculum: BuiltCurriculum;
  graph: BuiltCurriculum["graph"];
}): string[] {
  return graph.skills.flatMap((skill) =>
    curriculum.idsByKey[skill.key] === undefined ? [skill.key] : [],
  );
}

/**
 * The checked graph with the skills the check added twice in other words merged, before they're
 * saved: identity search finds twins of the skills already saved, but two new siblings would each
 * become a skill (see `mergeSkillTwinsStep`).
 */
export async function mergeAddedTwins({
  context,
  curriculum,
  graph,
  scope,
}: {
  context: GoalRunContext;
  curriculum: BuiltCurriculum;
  graph: BuiltCurriculum["graph"];
  scope: CurriculumScope;
}): Promise<BuiltCurriculum["graph"]> {
  const newKeys = listAddedKeys({ curriculum, graph });

  return newKeys.length > 1 ? mergeSkillTwinsStep({ ...context, graph, newKeys, scope }) : graph;
}

/** The skills the check added, saved to the Library in slices, with their prerequisites linked. */
export async function saveAddedSkills({
  context,
  curriculum,
  graph,
  scope,
}: {
  context: GoalRunContext;
  curriculum: BuiltCurriculum;
  graph: BuiltCurriculum["graph"];
  scope: CurriculumScope;
}): Promise<Record<string, string>> {
  const newKeys = new Set(listAddedKeys({ curriculum, graph }));
  const added = graph.skills.filter((skill) => newKeys.has(skill.key));

  if (added.length === 0) {
    return curriculum.idsByKey;
  }

  const saved = await Promise.all(
    toSlices(added).map((skills) =>
      saveGoalSkillsStep({ ...context, provenance: curriculum.provenance, scope, skills }),
    ),
  );

  const idsByKey = Object.fromEntries(
    [curriculum.idsByKey, ...saved].flatMap((ids) => Object.entries(ids)),
  );

  await linkSkillPrerequisitesStep({ idsByKey, skills: added });
  return idsByKey;
}
