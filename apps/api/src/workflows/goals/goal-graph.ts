import { needsCoverageCheck } from "@zoonk/core/library/curriculum/add-coverage-skills";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import {
  type GoalOpeningPin,
  pinGraphToOpening,
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
  opening: Promise<GoalOpeningPin | null>;
  researchId?: string | null;
  scope: CurriculumScope;
}) {
  const [built, references, pin] = await Promise.all([
    buildGoalSkillGraph({ ...context, inputs, scope }),
    loadGoalReferences({ inputs, researchId }),
    opening,
  ]);

  const outline = inputs.graphPrompt.examBlueprint;

  const covered = needsCoverageCheck({ graph: built.graph, outline, references })
    ? await checkGraphCoverageStep({ ...context, graph: built.graph, inputs, references, scope })
    : built;

  // Pinned before the twins are merged, so a near copy of the opening merges into it, and again
  // after, so it stays the start whatever the merge gave it.
  const merged = await mergeSkillTwinsStep({
    ...context,
    graph: pinGraphToOpening({ graph: covered.graph, pin }).graph,
    scope,
  });

  const pinned = pinGraphToOpening({ graph: merged, pin });
  const courseIdsByKey = { ...built.courseIdsByKey, ...pinned.courseIdsByKey };

  return { ...built, courseIdsByKey, graph: pinned.graph, savedSkillIds: pinned.idsByKey };
}

export type BuiltGraph = Omit<Awaited<ReturnType<typeof buildGraph>>, "savedSkillIds"> & {
  /** Skills the opening already saved. */
  savedSkillIds?: Record<string, string>;
};
