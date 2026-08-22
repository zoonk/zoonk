import { type LessonQuestionResource } from "@zoonk/core/lesson-questions/contract";

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
