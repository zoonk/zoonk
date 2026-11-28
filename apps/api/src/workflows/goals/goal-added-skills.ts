import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { type BuiltCurriculum, toSlices } from "./goal-curriculum";
import { type GoalRunContext } from "./goal-run-context";
import { linkSkillPrerequisitesStep, saveGoalSkillsStep } from "./steps/goal-curriculum-steps";
import { mergeSkillTwinsStep } from "./steps/skill-twins-step";

function listAddedKeys({
  curriculum,
  graph,
}: {
  curriculum: Pick<BuiltCurriculum, "idsByKey">;
  graph: BuiltCurriculum["graph"];
}): string[] {
  return graph.skills.flatMap((skill) =>
    curriculum.idsByKey[skill.key] === undefined ? [skill.key] : [],
  );
}

/** Identity search finds twins of saved skills, but two new siblings would each become a skill. */
export async function mergeAddedTwins({
  context,
  curriculum,
  graph,
  scope,
}: {
  context: GoalRunContext;
  curriculum: Pick<BuiltCurriculum, "idsByKey">;
  graph: BuiltCurriculum["graph"];
  scope: CurriculumScope;
}): Promise<BuiltCurriculum["graph"]> {
  const newKeys = listAddedKeys({ curriculum, graph });

  return newKeys.length > 1 ? mergeSkillTwinsStep({ ...context, graph, newKeys, scope }) : graph;
}

export async function saveAddedSkills({
  context,
  curriculum,
  graph,
  provenance,
  provenanceByKey = {},
  scope,
}: {
  context: GoalRunContext;
  curriculum: Pick<BuiltCurriculum, "idsByKey">;
  graph: BuiltCurriculum["graph"];
  provenance: BuiltCurriculum["provenance"];
  provenanceByKey?: Record<string, BuiltCurriculum["provenance"]>;
  scope: CurriculumScope;
}): Promise<Record<string, string>> {
  const newKeys = new Set(listAddedKeys({ curriculum, graph }));
  const added = graph.skills.filter((skill) => newKeys.has(skill.key));

  if (added.length === 0) {
    return curriculum.idsByKey;
  }

  const groups = Map.groupBy(added, (skill) => provenanceByKey[skill.key] ?? provenance);

  const saved = await Promise.all(
    [...groups].flatMap(([generation, skills]) =>
      toSlices(skills).map((slice) =>
        saveGoalSkillsStep({
          ...context,
          courses: graph.courses,
          provenance: generation,
          scope,
          skills: slice,
        }),
      ),
    ),
  );

  const idsByKey = Object.fromEntries(
    [curriculum.idsByKey, ...saved].flatMap((ids) => Object.entries(ids)),
  );

  await linkSkillPrerequisitesStep({ idsByKey, skills: added });
  return idsByKey;
}
