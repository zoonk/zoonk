import {
  type LessonQuestionMemoryChange,
  type LessonQuestionResource,
} from "@zoonk/core/lesson-questions/contract";
import { type LessonQuestionApiError } from "./lesson-question-api";
import { type LessonQuestionContext } from "./lesson-question-context";
import {
  isSameDraftContext,
  mergeCreatedQuestion,
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
  /** What each answer changed in the learner's memory, for "Memory updated" under it. */
  memoryChanges: Record<string, LessonQuestionMemoryChange[]>;
  nextCursor: string | null;
  questions: LessonQuestionResource[];
  requestError: LessonQuestionApiError | null;
  revealedQuestionId: string | null;
  /** The suggested question the learner picked, so sending it unchanged says it was a suggestion. */
  suggestion: string | null;
};

export type LessonQuestionAction =
  | { context: LessonQuestionContext; type: "open" }
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
  | { question: string; type: "suggestionChosen" }
  | { type: "questionCreateStarted" }
  | { question: LessonQuestionResource; type: "questionCreated" }
  | { reason: LessonQuestionApiError; type: "questionCreateFailed" }
  | { questionId: string; type: "answerStarted" }
  | { chunk: string; questionId: string; type: "answerChunkReceived" }
  | { questionId: string; type: "answerCompleted" }
  | { changes: LessonQuestionMemoryChange[]; questionId: string; type: "memoryUpdated" }
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

function updateAnswerStarted(question: LessonQuestionResource): LessonQuestionResource {
  return { ...question, answer: null, status: "running" };
}

function updateAnswerChunk({
  chunk,
  question,
}: {
  chunk: string;
  question: LessonQuestionResource;
}): LessonQuestionResource {
  return { ...question, answer: `${question.answer ?? ""}${chunk}`, status: "running" };
}

function updateAnswerStatus({
  question,
  status,
}: {
  question: LessonQuestionResource;
  status: "completed" | "failed";
}): LessonQuestionResource {
  return { ...question, status };
}

function reduceAnswerStarted({
  action,
  state,
}: {
  action: Extract<LessonQuestionAction, { type: "answerStarted" }>;
  state: LessonQuestionState;
}): LessonQuestionState {
  if (
    state.questions.find((question) => question.id === action.questionId)?.status === "completed"
  ) {
    return state;
  }

  return {
    ...state,
    activeQuestionId: action.questionId,
    answerError: null,
    questions: updateQuestionById({
      questionId: action.questionId,
      questions: state.questions,
      update: updateAnswerStarted,
    }),
  };
}

function reduceAnswerChunk({
  action,
  state,
}: {
  action: Extract<LessonQuestionAction, { type: "answerChunkReceived" }>;
  state: LessonQuestionState;
}): LessonQuestionState {
  if (state.activeQuestionId !== action.questionId) {
    return state;
  }

  return {
    ...state,
    questions: updateQuestionById({
      questionId: action.questionId,
      questions: state.questions,
      update: (question) => updateAnswerChunk({ chunk: action.chunk, question }),
    }),
  };
}

function reduceAnswerFinished({
  action,
  state,
}: {
  action: Extract<LessonQuestionAction, { type: "answerCompleted" | "answerFailed" }>;
  state: LessonQuestionState;
}): LessonQuestionState {
  if (
    (state.activeQuestionId !== null && state.activeQuestionId !== action.questionId) ||
    state.questions.find((question) => question.id === action.questionId)?.status === "completed"
  ) {
    return state;
  }

  const status = action.type === "answerCompleted" ? "completed" : "failed";

  return {
    ...state,
    activeQuestionId: null,
    answerError:
      action.type === "answerFailed"
        ? { questionId: action.questionId, reason: action.reason }
        : null,
    questions: updateQuestionById({
      questionId: action.questionId,
      questions: state.questions,
      update: (question) => updateAnswerStatus({ question, status }),
    }),
  };
}

export function lessonQuestionReducer(
  state: LessonQuestionState,
  action: LessonQuestionAction,
): LessonQuestionState {
  if (isLessonQuestionThreadAction(action)) {
    return reduceLessonQuestionThreadAction({ action, state });
  }

  switch (action.type) {
    case "open":
      return {
        ...state,
        context: action.context,
        draft: isSameDraftContext({ current: state.context, next: action.context })
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
        draft: action.question,
        error: null,
        requestError: null,
        suggestion: action.question,
      };
    case "questionCreateStarted":
      return { ...state, error: null, isCreating: true, requestError: null };
    case "questionCreated":
      return reduceQuestionCreated({ question: action.question, state });
    case "questionCreateFailed":
      return { ...state, error: "create", isCreating: false, requestError: action.reason };
    case "answerStarted":
      return reduceAnswerStarted({ action, state: { ...state, requestError: null } });
    case "answerChunkReceived":
      return reduceAnswerChunk({ action, state });
    case "answerCompleted":
    case "answerFailed":
      return reduceAnswerFinished({ action, state });
    case "memoryUpdated":
      return {
        ...state,
        memoryChanges: { ...state.memoryChanges, [action.questionId]: action.changes },
      };
    default:
      return state;
  }
}
