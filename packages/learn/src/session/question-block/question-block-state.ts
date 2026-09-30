import {
  type StudyAnswerFeedback,
  type StudyBlockDetail,
  type StudyMomentView,
  type StudyQuestionAnswer,
} from "../session-types";

/** Where the block is: answering, waiting for the grade, reading it, or finished. */
export type QuestionBlockPhase =
  | { kind: "answering" }
  | { kind: "checking" }
  | { answer: StudyQuestionAnswer; feedback: StudyAnswerFeedback; kind: "feedback" }
  | { kind: "answerFailed"; retryAfterSeconds: number | null }
  | { kind: "finishing" }
  | { kind: "finishFailed" }
  | { kind: "finished"; moment: StudyMomentView };

export type QuestionBlockState = {
  /** Answers given in this visit, for the net score. */
  answers: Record<string, { answer: StudyQuestionAnswer; isCorrect: boolean }>;
  hyperdrive: number;
  index: number;
  phase: QuestionBlockPhase;
};

type QuestionBlockAction =
  | { type: "check" }
  | { answer: StudyQuestionAnswer; feedback: StudyAnswerFeedback; itemId: string; type: "answered" }
  | { retryAfterSeconds: number | null; type: "answerFailed" }
  | { type: "next" }
  | { type: "finish" }
  | { type: "finishFailed" }
  | { moment: StudyMomentView; type: "finished" };

function firstUnanswered(detail: StudyBlockDetail): number {
  const index = detail.questions.findIndex((question) => question.answered === null);
  return index === -1 ? detail.questions.length : index;
}

/** A block resumes at its first unanswered question; one fully answered goes straight to its end. */
export function createQuestionBlockState(detail: StudyBlockDetail): QuestionBlockState {
  const index = firstUnanswered(detail);

  return {
    answers: {},
    hyperdrive: 1,
    index,
    phase: index >= detail.questions.length ? { kind: "finishing" } : { kind: "answering" },
  };
}

/** Moves to the next question, or to the block's end after the last one. */
function advance({ state, total }: { state: QuestionBlockState; total: number }) {
  const index = state.index + 1;

  return {
    ...state,
    index,
    phase: index >= total ? ({ kind: "finishing" } as const) : ({ kind: "answering" } as const),
  };
}

export function questionBlockReducer(
  total: number,
): (state: QuestionBlockState, action: QuestionBlockAction) => QuestionBlockState {
  return (state, action) => {
    switch (action.type) {
      case "check":
        return { ...state, phase: { kind: "checking" } };
      case "answered":
        return {
          ...state,
          answers: {
            ...state.answers,
            [action.itemId]: { answer: action.answer, isCorrect: action.feedback.isCorrect },
          },
          hyperdrive: action.feedback.hyperdrive.level,
          phase: { answer: action.answer, feedback: action.feedback, kind: "feedback" },
        };
      case "next":
        return advance({ state, total });
      case "answerFailed":
        return {
          ...state,
          phase: { kind: "answerFailed", retryAfterSeconds: action.retryAfterSeconds },
        };
      case "finish":
        return { ...state, phase: { kind: "finishing" } };
      case "finishFailed":
        return { ...state, phase: { kind: "finishFailed" } };
      case "finished":
        return { ...state, phase: { kind: "finished", moment: action.moment } };
      default:
        return state;
    }
  };
}
