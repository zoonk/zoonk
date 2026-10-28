import {
  type LessonQuestionMemoryChange,
  type LessonQuestionResource,
  type LessonScreenSuggestion,
  type TutorToolOffer,
} from "@zoonk/core/lesson-questions/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import {
  isLessonQuestionAnswerAction,
  reduceLessonQuestionAnswerAction,
} from "./lesson-question-answer-state";
import { type LessonQuestionApiError } from "./lesson-question-api";
import { type LessonQuestionContext } from "./lesson-question-context";
import {
  answerPlanChange,
  isSameDraftContext,
  mergeCreatedQuestion,
  replacePlanChanges,
  updateQuestionById,
} from "./lesson-question-state-helpers";
import {
  isLessonQuestionThreadAction,
  reduceLessonQuestionThreadAction,
} from "./lesson-question-thread-state";

type LessonQuestionError = "create" | "load" | null;
type LessonQuestionLoadStatus = "idle" | "loading" | "ready";

export type LessonQuestionState = {
  activeQuestionId: string | null;
  answerError: { questionId: string; reason: LessonQuestionApiError } | null;
  context: LessonQuestionContext;
  draft: string;
  earlierLoadFailed: boolean;
  error: LessonQuestionError;
  hasMore: boolean;
  isCreating: boolean;
  isLoadingEarlier: boolean;
  isOpen: boolean;
  isRefreshing: boolean;
  loadStatus: LessonQuestionLoadStatus;
  memoryChanges: Record<string, LessonQuestionMemoryChange[]>;
  nextCursor: string | null;
  questions: LessonQuestionResource[];
  requestError: LessonQuestionApiError | null;
  revealedQuestionId: string | null;
  streamedAnswerIds: string[];
  suggestion: OfferedSuggestion | null;
};

export type OfferedSuggestion = { question: string; suggestion?: LessonScreenSuggestion };

export type LessonQuestionAction =
  | { context: LessonQuestionContext; keepDraft?: boolean; type: "open" }
  | { type: "close" }
  | { type: "threadLoadStarted" }
  | {
      hasMore: boolean;
      nextCursor: string | null;
      questions: LessonQuestionResource[];
      type: "threadLoaded";
    }
  | { reason: LessonQuestionApiError; type: "threadLoadFailed" }
  | { questions: LessonQuestionResource[]; type: "latestThreadReconciled" }
  | { type: "earlierThreadLoadStarted" }
  | {
      hasMore: boolean;
      nextCursor: string | null;
      questions: LessonQuestionResource[];
      type: "earlierThreadLoaded";
    }
  | { type: "earlierThreadLoadFailed" }
  | { draft: string; type: "draftChanged" }
  | { suggestion: OfferedSuggestion; type: "suggestionChosen" }
  | { type: "questionCreateStarted" }
  | { question: LessonQuestionResource; type: "questionCreated" }
  | { reason: LessonQuestionApiError; type: "questionCreateFailed" }
  | { questionId: string; type: "answerStarted" }
  | { chunk: string; questionId: string; type: "answerChunkReceived" }
  | { questionId: string; type: "answerCompleted" }
  | { answer: string; questionId: string; type: "answerSaved" }
  | { changes: LessonQuestionMemoryChange[]; questionId: string; type: "memoryUpdated" }
  | { change: PlanChangeView; questionId: string; type: "planChangeProposed" }
  | { change: PlanChangeView; type: "planChangeAnswered" }
  | { changeIds: string[]; type: "planChangesReplaced" }
  | { offer: TutorToolOffer; questionId: string; type: "toolOffered" }
  | { questionId: string; reason: LessonQuestionApiError; type: "answerFailed" };

export const INITIAL_LESSON_QUESTION_STATE: LessonQuestionState = {
  activeQuestionId: null,
  answerError: null,
  context: { kind: "lesson" },
  draft: "",
  earlierLoadFailed: false,
  error: null,
  hasMore: false,
  isCreating: false,
  isLoadingEarlier: false,
  isOpen: false,
  isRefreshing: false,
  loadStatus: "idle",
  memoryChanges: {},
  nextCursor: null,
  questions: [],
  requestError: null,
  revealedQuestionId: null,
  streamedAnswerIds: [],
  suggestion: null,
};

function reduceQuestionCreated({
  question,
  state,
}: {
  question: LessonQuestionResource;
  state: LessonQuestionState;
}): LessonQuestionState {
  return {
    ...state,
    draft: state.draft.trim() === question.question ? "" : state.draft,
    error: null,
    isCreating: false,
    questions: mergeCreatedQuestion({ question, questions: state.questions }),
    requestError: null,
    revealedQuestionId: question.status === "completed" ? question.id : null,
  };
}

export function lessonQuestionReducer(
  state: LessonQuestionState,
  action: LessonQuestionAction,
): LessonQuestionState {
  if (isLessonQuestionThreadAction(action)) {
    return reduceLessonQuestionThreadAction({ action, state });
  }

  if (isLessonQuestionAnswerAction(action)) {
    return reduceLessonQuestionAnswerAction({ action, state });
  }

  switch (action.type) {
    case "open":
      return {
        ...state,
        context: action.context,
        draft:
          action.keepDraft || isSameDraftContext({ current: state.context, next: action.context })
            ? state.draft
            : "",
        isOpen: true,
        revealedQuestionId: null,
      };
    case "close":
      return { ...state, isOpen: false };
    case "draftChanged":
      return { ...state, draft: action.draft, error: null, requestError: null };
    case "suggestionChosen":
      return {
        ...state,
        draft: action.suggestion.question,
        error: null,
        requestError: null,
        suggestion: action.suggestion,
      };
    case "questionCreateStarted":
      return { ...state, error: null, isCreating: true, requestError: null };
    case "questionCreated":
      return reduceQuestionCreated({ question: action.question, state });
    case "questionCreateFailed":
      return { ...state, error: "create", isCreating: false, requestError: action.reason };
    case "memoryUpdated":
      return {
        ...state,
        memoryChanges: { ...state.memoryChanges, [action.questionId]: action.changes },
      };
    case "planChangeProposed":
      return {
        ...state,
        questions: updateQuestionById({
          questionId: action.questionId,
          questions: state.questions,
          update: (question) => ({ ...question, planChange: action.change }),
        }),
      };
    case "planChangeAnswered":
      return {
        ...state,
        questions: answerPlanChange({ change: action.change, questions: state.questions }),
      };
    case "planChangesReplaced":
      return {
        ...state,
        questions: replacePlanChanges({ changeIds: action.changeIds, questions: state.questions }),
      };
    case "toolOffered":
      return {
        ...state,
        questions: updateQuestionById({
          questionId: action.questionId,
          questions: state.questions,
          update: (question) => ({ ...question, toolOffer: action.offer }),
        }),
      };
    default:
      return state;
  }
}
