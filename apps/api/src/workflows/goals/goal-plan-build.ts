import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { startPairLevelTest } from "./goal-ahead";
import { waitForGraphInputs } from "./goal-content-inputs";
import { type GoalContentInput } from "./goal-content-workflow";
import { type BuiltCurriculum, buildCurriculum } from "./goal-curriculum";
import { hasOpening, openGoal } from "./goal-opening";
import { type GoalRunContext } from "./goal-run-context";
import { prepareWarmUp } from "./goal-warm-up";
import { decideGoalScopeStep, keepMaterialPrivate } from "./steps/goal-curriculum-steps";
import { readSavedGoalOpeningStep } from "./steps/goal-opening-steps";

type BuiltPlan = {
  curriculum: BuiltCurriculum;
  /** Settles once the learner's first lesson is ready, or once nothing more will report it. */
  firstLesson: Promise<unknown>;
  inputs: GoalCurriculumInputs;
  researchId: string | null;
  scope: CurriculumScope;
};

async function buildScopedPlan({
  context,
  decided,
  initial,
  input,
}: {
  context: GoalRunContext;
  decided: Promise<CurriculumScope>;
  initial: GoalCurriculumInputs;
  input: GoalContentInput;
}): Promise<BuiltPlan | null> {
  const rebuild = Boolean(input.rebuild);

  const [inputs] = await Promise.all([
    decided.then((scope) =>
      waitForGraphInputs({
        initial,
        researchId: input.researchId,
        scope: keepMaterialPrivate({ inputs: initial, scope }),
      }),
    ),
    rebuild ? null : startPairLevelTest({ context, goal: initial.goal }),
  ]);

  if (!inputs || inputs.hasPlanGraph !== rebuild) {
    return null;
  }

  const scope = keepMaterialPrivate({ inputs, scope: await decided });
  const researchId = input.researchId ?? null;
  const opening = hasOpening({ inputs, rebuild }) ? openGoal({ context, inputs, scope }) : null;

  const curriculum = await buildCurriculum({
    context,
    inputs,
    opening: rebuild
      ? readSavedGoalOpeningStep(input.goalId).then((saved) => saved?.skill ?? null)
      : opening?.skill,
    rebuild,
    researchId,
    scope,
  }).catch(async (error: unknown) => {
    // The first lesson's run outlives this one once it has started.
    await opening?.started;
    throw error;
  });

  return {
    curriculum,
    firstLesson: opening?.settled ?? Promise.resolve(),
    inputs,
    researchId,
    scope,
  };
}

export function buildPlan({
  context,
  initial,
  input,
}: {
  context: GoalRunContext;
  initial: GoalCurriculumInputs;
  input: GoalContentInput;
}) {
  const decided = decideGoalScopeStep({ ...context, inputs: initial });

  const warmUp = input.rebuild
    ? Promise.resolve(null)
    : decided
        .then((scope) =>
          prepareWarmUp({
            context,
            goalId: input.goalId,
            scope: keepMaterialPrivate({ inputs: initial, scope }),
          }),
        )
        .catch(() => null);

  return { plan: buildScopedPlan({ context, decided, initial, input }), warmUp };
}
