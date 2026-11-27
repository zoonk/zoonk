import { type LessonQuestionResource } from "@zoonk/core/lesson-questions/contract";
import { type LessonQuestionApiError } from "./lesson-question-api";
import { type LessonQuestionState } from "./lesson-question-state";

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

const CREATE_NAVIGATION_ERROR_KINDS = new Set(["authentication", "subscription", "unavailable"]);

/** `limited`: a limit refused asking and still holds, so the draft waits in the composer. */
export function getComposerAvailability({
  isResolvingPreviousQuestion,
  limited,
  state,
}: {
  isResolvingPreviousQuestion: boolean;
  limited: boolean;
  state: LessonQuestionState;
}) {
  const isBusy =
    state.activeQuestionId !== null ||
    state.creating !== null ||
    state.isRefreshing ||
    state.questions.some(doesLessonQuestionBlockNewQuestion);

  const createNavigationError =
    state.error === "create" &&
    Boolean(state.requestError && CREATE_NAVIGATION_ERROR_KINDS.has(state.requestError.kind));

  const isReady = state.loadStatus === "ready";
  const hasQuestionToSend = Boolean(state.draft.trim()) || isResolvingPreviousQuestion;

  return {
    canSend: isReady && !isBusy && !limited && !createNavigationError && hasQuestionToSend,
    createNavigationError,
  };
}
