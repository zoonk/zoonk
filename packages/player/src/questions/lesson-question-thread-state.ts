import { type LessonQuestionAction, type LessonQuestionState } from "./lesson-question-state";
import {
  getReconciledAnswerError,
  mergeEarlierQuestions,
  mergeLatestQuestions,
} from "./lesson-question-state-helpers";

type LessonQuestionThreadAction = Extract<
  LessonQuestionAction,
  {
    type:
      | "earlierThreadLoaded"
      | "earlierThreadLoadFailed"
      | "earlierThreadLoadStarted"
      | "latestThreadReconciled"
      | "threadLoaded"
      | "threadLoadFailed"
      | "threadLoadStarted";
  }
>;

const LESSON_QUESTION_THREAD_ACTION_TYPES: ReadonlySet<LessonQuestionAction["type"]> = new Set([
  "earlierThreadLoaded",
  "earlierThreadLoadFailed",
  "earlierThreadLoadStarted",
  "latestThreadReconciled",
  "threadLoaded",
  "threadLoadFailed",
  "threadLoadStarted",
]);

/** A refresh may skip a page of new questions; keep its cursor so those questions remain reachable. */
function getRefreshedPagination({
  state,
  action,
}: {
  state: LessonQuestionState;
  action: Extract<LessonQuestionAction, { type: "threadLoaded" }>;
}) {
  const currentIds = new Set(state.questions.map((question) => question.id));
  const hasOverlap = action.questions.some((question) => currentIds.has(question.id));

  if (state.loadStatus === "ready" && hasOverlap) {
    return { hasMore: state.hasMore, nextCursor: state.nextCursor };
  }

  return { hasMore: action.hasMore, nextCursor: action.nextCursor };
}

export function isLessonQuestionThreadAction(
  action: LessonQuestionAction,
): action is LessonQuestionThreadAction {
  return LESSON_QUESTION_THREAD_ACTION_TYPES.has(action.type);
}

export function reduceLessonQuestionThreadAction({
  action,
  state,
}: {
  action: LessonQuestionThreadAction;
  state: LessonQuestionState;
}): LessonQuestionState {
  switch (action.type) {
    case "threadLoadStarted":
      return {
        ...state,
        error: null,
        isLoadingEarlier: false,
        isRefreshing: true,
        loadStatus: state.loadStatus === "ready" ? "ready" : "loading",
        requestError: null,
      };
    case "threadLoaded":
      return {
        ...state,
        ...getRefreshedPagination({ action, state }),
        activeQuestionId: null,
        answerError: getReconciledAnswerError({
          answerError: state.answerError,
          questions: action.questions,
        }),
        earlierLoadFailed: false,
        error: null,
        isCreating: false,
        isLoadingEarlier: false,
        isRefreshing: false,
        loadStatus: "ready",
        questions: mergeLatestQuestions({
          currentQuestions: state.questions,
          latestQuestions: action.questions,
        }),
        requestError: null,
      };
    case "threadLoadFailed":
      return state.loadStatus === "ready"
        ? { ...state, isRefreshing: false }
        : {
            ...state,
            error: "load",
            isRefreshing: false,
            loadStatus: "idle",
            requestError: action.reason,
          };
    case "latestThreadReconciled":
      return {
        ...state,
        activeQuestionId: null,
        answerError: getReconciledAnswerError({
          answerError: state.answerError,
          questions: action.questions,
        }),
        error: null,
        isCreating: false,
        questions: mergeLatestQuestions({
          currentQuestions: state.questions,
          latestQuestions: action.questions,
        }),
        requestError: null,
      };
    case "earlierThreadLoadStarted":
      return { ...state, earlierLoadFailed: false, isLoadingEarlier: true };
    case "earlierThreadLoaded":
      return {
        ...state,
        earlierLoadFailed: false,
        hasMore: action.hasMore,
        isLoadingEarlier: false,
        nextCursor: action.nextCursor,
        questions: mergeEarlierQuestions({
          currentQuestions: state.questions,
          earlierQuestions: action.questions,
        }),
      };
    case "earlierThreadLoadFailed":
      return { ...state, earlierLoadFailed: true, isLoadingEarlier: false };
    default:
      return state;
  }
}
