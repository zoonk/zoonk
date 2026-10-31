import "server-only";
import { LESSON_QUESTION_MODEL } from "@zoonk/ai/tasks/lessons/question";
import {
  type LessonQuestionContextSnapshot,
  type PlanScopeContext,
} from "@zoonk/ai/tasks/lessons/question-context";
import { GOAL_TUTOR_MODEL } from "@zoonk/ai/tasks/tutor/goal-tutor";

type TutorAnswerKind = { contextSnapshot: LessonQuestionContextSnapshot; shareAnswer: boolean };

/** An answer shared by everyone who asks the same thing on a screen never sees the learner's plan. */
export function isGoalTutorAnswer<T extends TutorAnswerKind>(
  answer: T,
): answer is T & { contextSnapshot: PlanScopeContext } {
  return answer.contextSnapshot.scope.kind === "plan" && !answer.shareAnswer;
}

export function getTutorModel(answer: TutorAnswerKind): string {
  return isGoalTutorAnswer(answer) ? GOAL_TUTOR_MODEL : LESSON_QUESTION_MODEL;
}
