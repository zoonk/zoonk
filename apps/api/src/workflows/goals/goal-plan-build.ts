import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { startPairLevelTest } from "./goal-ahead";
import { waitForGraphInputs } from "./goal-content-inputs";
import { type GoalContentInput } from "./goal-content-workflow";
import { type BuiltCurriculum, buildCurriculum } from "./goal-curriculum";
import { type GoalRunContext } from "./goal-run-context";
import { prepareWarmUp } from "./goal-warm-up";
import { decideGoalScopeStep, keepMaterialPrivate } from "./steps/goal-curriculum-steps";

type BuiltPlan = {
  curriculum: BuiltCurriculum;
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

  const [inputs, scopeDecision] = await Promise.all([
    waitForGraphInputs({ initial, researchId: input.researchId }),
    decided,
    rebuild ? null : startPairLevelTest({ context, goal: initial.goal }),
  ]);

  if (!inputs || inputs.hasPlanGraph !== rebuild) {
    return null;
  }

  const scope = keepMaterialPrivate({ inputs, scope: scopeDecision });
  const researchId = input.researchId ?? null;
  const curriculum = await buildCurriculum({ context, inputs, rebuild, researchId, scope });

  return { curriculum, inputs, researchId, scope };
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
