import { getShownOrder, showInOrder } from "../../../sessions/_utils/shown-order";
import { type LevelTestAnswerInput } from "../level-test-contract";

type LevelTestShowing = {
  /** Missing for a goal's first test, from onboarding, which has no attempt of its own. */
  attemptId: string | undefined;
  goalId: string;
  question: { id: string; options: readonly string[] };
};

/** Each attempt shows a question's options in its own order, so a retake tests what they say rather than where they were. */
function getShowingSeed({ attemptId, goalId, question }: LevelTestShowing): string {
  return `level-test:${attemptId ?? goalId}:${question.id}`;
}

export function showLevelTestOptions(showing: LevelTestShowing): string[] {
  return showInOrder({ items: showing.question.options, seed: getShowingSeed(showing) });
}

/** The answer with each tapped place turned into its bank index: answers are graded and saved in bank order. */
export function toBankAnswer({
  input,
  ...showing
}: LevelTestShowing & { input: LevelTestAnswerInput }): LevelTestAnswerInput {
  const order = getShownOrder({
    count: showing.question.options.length,
    seed: getShowingSeed(showing),
  });

  const toBank = (index: number) => order[index] ?? index;

  return {
    ...input,
    answerIndex: input.answerIndex === null ? null : toBank(input.answerIndex),
    ...(input.answerIndices && { answerIndices: input.answerIndices.map(toBank) }),
  };
}
