import "server-only";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { type CurriculumScope } from "./curriculum-scope";
import { type GoalCurriculumInputs, loadGoalCurriculumInputs } from "./goal-curriculum-inputs";
import { getGraphQuestions, isAwaitingGraphAnswers } from "./shared-graph-prompt";

/** Internal workflow bridge: the goal comes from its authorized run. */
export async function beginGoalCurriculum({
  goalId,
  scope,
}: {
  goalId: string;
  scope: Pick<CurriculumScope, "ownerId">;
}): Promise<GoalCurriculumInputs | null> {
  const inputs = await loadGoalCurriculumInputs(goalId);

  if (!inputs) {
    return null;
  }

  if (isAwaitingGraphAnswers({ inputs, scope })) {
    return inputs;
  }

  const curriculumQuestions = getGraphQuestions({ inputs, scope });

  await writeLearnerChange({ userId: inputs.goal.userId }, async (tx) => {
    const saved = await tx.goal.updateMany({
      data: { curriculumQuestions },
      where: { NOT: { curriculumQuestions: { equals: curriculumQuestions } }, id: inputs.goal.id },
    });

    return saved.count > 0 ? null : unchanged(null);
  });

  // An earlier edit is in this read; a later edit sees the recorded questions and owes a rebuild.
  return loadGoalCurriculumInputs(goalId);
}
