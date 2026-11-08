import { needsCoverageCheck } from "@zoonk/core/library/curriculum/add-coverage-skills";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import {
  type GoalOpeningSkill,
  keepOpeningFirst,
} from "@zoonk/core/library/curriculum/opening-graph";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { loadGoalReferences } from "./goal-content-inputs";
import { type GoalRunContext } from "./goal-run-context";
import { buildGoalSkillGraph } from "./goal-skill-graph";
import { checkGraphCoverageStep } from "./steps/goal-curriculum-steps";
import { mergeSkillTwinsStep } from "./steps/skill-twins-step";

export async function buildGraph({
  context,
  inputs,
  opening,
  researchId,
  scope,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
  /** The learner's first skill, which the graph reads and starts with. */
  opening: Promise<GoalOpeningSkill | null>;
  researchId?: string | null;
  scope: CurriculumScope;
}) {
  const [built, references, first] = await Promise.all([
    opening.then((firstSkill) => buildGoalSkillGraph({ ...context, firstSkill, inputs, scope })),
    loadGoalReferences({ inputs, researchId }),
    opening,
  ]);

  const outline = inputs.graphPrompt.examBlueprint;

  const covered = needsCoverageCheck({ graph: built.graph, outline, references })
    ? await checkGraphCoverageStep({ ...context, graph: built.graph, inputs, references, scope })
    : built;

  const merged = await mergeSkillTwinsStep({ ...context, graph: covered.graph, scope });
  const kept = keepOpeningFirst({ graph: merged, opening: first });
  const courseIdsByKey = { ...built.courseIdsByKey, ...kept.courseIdsByKey };

  return { ...built, courseIdsByKey, graph: kept.graph, savedSkillIds: kept.idsByKey };
}

export type BuiltGraph = Omit<Awaited<ReturnType<typeof buildGraph>>, "savedSkillIds"> & {
  /** Skills the opening already saved. */
  savedSkillIds?: Record<string, string>;
};
