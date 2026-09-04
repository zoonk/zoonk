import { type LessonQuestionResource } from "@zoonk/core/lesson-questions/contract";
import { type PlayerQuestionContext } from "../player-context";
import { type LessonQuestionApiError } from "./lesson-question-api";
import {
  isSameDraftContext,
  mergeCreatedQuestion,
  updateQuestionById,
} from "./lesson-question-state-helpers";
import {
  isLessonQuestionThreadAction,
  reduceLessonQuestionThreadAction,
} from "./lesson-question-thread-state";

type LessonQuestionError = "copy" | "create" | "load" | null;
type LessonQuestionLoadStatus = "idle" | "loading" | "ready";

export type LessonQuestionState = {
  activeQuestionId: string | null;
  answerError: { questionId: string; reason: LessonQuestionApiError } | null;
  context: PlayerQuestionContext;
  copied: boolean;
  draft: string;
  earlierLoadFailed: boolean;
  error: LessonQuestionError;
  hasMore: boolean;
  isCreating: boolean;
  isLoadingEarlier: boolean;
  isOpen: boolean;
  isRefreshing: boolean;
  loadStatus: LessonQuestionLoadStatus;
  nextCursor: string | null;
  questions: LessonQuestionResource[];
  requestError: LessonQuestionApiError | null;
  revealedQuestionId: string | null;
};

export type LessonQuestionAction =
  | { context: PlayerQuestionContext; type: "open" }
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
  | { type: "questionCreateStarted" }
  | { question: LessonQuestionResource; type: "questionCreated" }
  | { reason: LessonQuestionApiError; type: "questionCreateFailed" }
  | { questionId: string; type: "answerStarted" }
  | { chunk: string; questionId: string; type: "answerChunkReceived" }
  | { questionId: string; type: "answerCompleted" }
  | { questionId: string; reason: LessonQuestionApiError; type: "answerFailed" }
  | { questionId: string; type: "answerLimitExpired" }
  | { type: "copied" }
  | { type: "copyFailed" };

export const INITIAL_LESSON_QUESTION_STATE: LessonQuestionState = {
  activeQuestionId: null,
  answerError: null,
  context: { kind: "lesson" },
  copied: false,
  draft: "",
  earlierLoadFailed: false,
  error: null,
  hasMore: false,
  isCreating: false,
  isLoadingEarlier: false,
  isOpen: false,
  isRefreshing: false,
  loadStatus: "idle",
  nextCursor: null,
  questions: [],
  requestError: null,
  revealedQuestionId: null,
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
    copied: false,
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
        copied: false,
        draft: isSameDraftContext({ current: state.context, next: action.context })
          ? state.draft
          : "",
        isOpen: true,
        revealedQuestionId: null,
      };
    case "close":
      return { ...state, copied: false, isOpen: false };
    case "draftChanged":
      return { ...state, copied: false, draft: action.draft, error: null, requestError: null };
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
    case "answerLimitExpired":
      return state.answerError?.questionId === action.questionId &&
        state.answerError.reason.kind === "limit"
        ? { ...state, answerError: null }
        : state;
    case "copied":
      return { ...state, copied: true, error: null, requestError: null };
    case "copyFailed":
      return { ...state, copied: false, error: "copy", requestError: { kind: "unknown" } };
    default:
      return state;
  }
}
