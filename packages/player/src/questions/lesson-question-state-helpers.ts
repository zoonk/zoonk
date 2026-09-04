import { type LessonQuestionResource } from "@zoonk/core/lesson-questions/contract";
import { type PlayerQuestionContext } from "../player-context";
import { type LessonQuestionApiError } from "./lesson-question-api";

export function updateQuestionById({
  questions,
  questionId,
  update,
}: {
  questions: LessonQuestionResource[];
  questionId: string;
  update: (question: LessonQuestionResource) => LessonQuestionResource;
}): LessonQuestionResource[] {
  return questions.map((question) => (question.id === questionId ? update(question) : question));
}

export function mergeCreatedQuestion({
  question,
  questions,
}: {
  question: LessonQuestionResource;
  questions: LessonQuestionResource[];
}) {
  const existingQuestion = questions.some((candidate) => candidate.id === question.id);

  if (!existingQuestion) {
    return [...questions, question];
  }

  return updateQuestionById({ questionId: question.id, questions, update: () => question });
}

export function mergeEarlierQuestions({
  currentQuestions,
  earlierQuestions,
}: {
  currentQuestions: LessonQuestionResource[];
  earlierQuestions: LessonQuestionResource[];
}) {
  const currentQuestionIds = new Set(currentQuestions.map((question) => question.id));

  const newEarlierQuestions = earlierQuestions.filter(
    (question) => !currentQuestionIds.has(question.id),
  );

  return [...newEarlierQuestions, ...currentQuestions];
}

export function mergeLatestQuestions({
  currentQuestions,
  latestQuestions,
}: {
  currentQuestions: LessonQuestionResource[];
  latestQuestions: LessonQuestionResource[];
}) {
  const latestQuestionIds = new Set(latestQuestions.map((question) => question.id));

  const retainedEarlierQuestions = currentQuestions.filter(
    (question) => !latestQuestionIds.has(question.id),
  );

  return [...retainedEarlierQuestions, ...latestQuestions];
}

export function isSameDraftContext({
  current,
  next,
}: {
  current: PlayerQuestionContext;
  next: PlayerQuestionContext;
}) {
  if (current.kind !== next.kind) {
    return false;
  }

  if (current.kind === "lesson" || next.kind === "lesson") {
    return true;
  }

  if (current.kind === "answer" && next.kind === "answer") {
    return (
      current.step.id === next.step.id &&
      JSON.stringify(current.selectedAnswer) === JSON.stringify(next.selectedAnswer)
    );
  }

  return current.kind === "step" && next.kind === "step" && current.step.id === next.step.id;
}

export function getReconciledAnswerError({
  answerError,
  questions,
}: {
  answerError: { questionId: string; reason: LessonQuestionApiError } | null;
  questions: LessonQuestionResource[];
}) {
  if (!answerError) {
    return null;
  }

  const question = questions.find((candidate) => candidate.id === answerError.questionId);
  return question?.status === "failed" ? answerError : null;
}
