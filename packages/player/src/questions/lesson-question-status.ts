import { type LessonQuestionResource } from "@zoonk/core/lesson-questions/contract";
import { type LessonQuestionApiError } from "./lesson-question-api";

export function isRetryableLessonQuestionStatusError(error: LessonQuestionApiError) {
  return error.kind === "unknown";
}

export function isLessonQuestionAnswerInProgress(question: LessonQuestionResource) {
  return question.status === "pending" || question.status === "running";
}

export function doesLessonQuestionBlockNewQuestion(question: LessonQuestionResource) {
  return question.status !== "completed";
}

export function hasOtherAnswerInProgress({
  questionId,
  questions,
}: {
  questionId: string;
  questions: LessonQuestionResource[];
}) {
  return questions.some(
    (question) => question.id !== questionId && isLessonQuestionAnswerInProgress(question),
  );
}
