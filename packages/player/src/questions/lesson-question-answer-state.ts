import { type LessonQuestionResource } from "@zoonk/core/lesson-questions/contract";
import { type LessonQuestionAction, type LessonQuestionState } from "./lesson-question-state";
import { updateQuestionById } from "./lesson-question-state-helpers";

type LessonQuestionAnswerAction = Extract<
  LessonQuestionAction,
  {
    type:
      | "answerChunkReceived"
      | "answerCompleted"
      | "answerFailed"
      | "answerSaved"
      | "answerStarted";
  }
>;

const LESSON_QUESTION_ANSWER_ACTION_TYPES: ReadonlySet<LessonQuestionAction["type"]> = new Set([
  "answerChunkReceived",
  "answerCompleted",
  "answerFailed",
  "answerSaved",
  "answerStarted",
]);

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
    streamedAnswerIds: [
      ...state.streamedAnswerIds.filter((id) => id !== action.questionId),
      action.questionId,
    ],
  };
}

function reduceAnswerSaved({
  action,
  state,
}: {
  action: Extract<LessonQuestionAction, { type: "answerSaved" }>;
  state: LessonQuestionState;
}): LessonQuestionState {
  return {
    ...state,
    questions: updateQuestionById({
      questionId: action.questionId,
      questions: state.questions,
      update: (question) => ({ ...question, answer: action.answer }),
    }),
    streamedAnswerIds: state.streamedAnswerIds.filter((id) => id !== action.questionId),
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

export function isLessonQuestionAnswerAction(
  action: LessonQuestionAction,
): action is LessonQuestionAnswerAction {
  return LESSON_QUESTION_ANSWER_ACTION_TYPES.has(action.type);
}

export function reduceLessonQuestionAnswerAction({
  action,
  state,
}: {
  action: LessonQuestionAnswerAction;
  state: LessonQuestionState;
}): LessonQuestionState {
  switch (action.type) {
    case "answerStarted":
      return reduceAnswerStarted({ action, state: { ...state, requestError: null } });
    case "answerChunkReceived":
      return reduceAnswerChunk({ action, state });
    case "answerSaved":
      return reduceAnswerSaved({ action, state });
    case "answerCompleted":
    case "answerFailed":
      return reduceAnswerFinished({ action, state });
    default:
      return action satisfies never;
  }
}
