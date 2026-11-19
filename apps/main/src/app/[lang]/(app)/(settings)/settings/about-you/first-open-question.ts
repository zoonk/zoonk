import {
  type ProfileQuestionsView,
  isBiographyQuestion,
} from "@zoonk/core/profile/questions/contract";

/**
 * The question a wide screen opens beside the list before the learner picks one: the first they
 * can still answer, else the first they can change. With memory off only how they learn can change.
 */
export function firstOpenQuestion(view: ProfileQuestionsView) {
  const open = view.questions.filter(
    (question) => view.memoryEnabled || !isBiographyQuestion(question.id),
  );

  return open.find((question) => question.status === null) ?? open[0] ?? null;
}
