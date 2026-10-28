import {
  type StudyAnswerFeedback,
  type StudyBlockDetail,
  type StudyMomentView,
  type StudyQuestionAnswer,
} from "../session-types";

export type QuestionBlockPhase =
  | { kind: "answering" }
  | { kind: "checking" }
  | { answer: StudyQuestionAnswer; feedback: StudyAnswerFeedback; kind: "feedback" }
  | { kind: "answerFailed" }
  | { kind: "alreadyAnswered" }
  | { kind: "finishing" }
  | { kind: "finishReady" }
  | { kind: "finishFailed" }
  | { kind: "finished"; moment: StudyMomentView };

export type QuestionBlockState = {
  answers: Record<string, { answer: StudyQuestionAnswer; blank: boolean; isCorrect: boolean }>;
  hyperdrive: number;
  index: number;
  phase: QuestionBlockPhase;
};

type QuestionBlockAction =
  | { type: "check" }
  | { answer: StudyQuestionAnswer; feedback: StudyAnswerFeedback; itemId: string; type: "answered" }
  | { type: "answerFailed" }
  | { type: "alreadyAnswered" }
  | { type: "next" }
  | { type: "finish" }
  | { type: "finishFailed" }
  | { moment: StudyMomentView; type: "finished" };

function firstUnanswered(detail: StudyBlockDetail): number {
  const index = detail.questions.findIndex((question) => question.answered === null);
  return index === -1 ? detail.questions.length : index;
}

/** A fully answered block still needs a click before completion can start any AI work. */
export function createQuestionBlockState(detail: StudyBlockDetail): QuestionBlockState {
  const index = firstUnanswered(detail);

  return {
    answers: {},
    hyperdrive: 1,
    index,
    phase: index >= detail.questions.length ? { kind: "finishReady" } : { kind: "answering" },
  };
}

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
            [action.itemId]: {
              answer: action.answer,
              blank: action.feedback.blank,
              isCorrect: action.feedback.isCorrect,
            },
          },
          hyperdrive: action.feedback.hyperdrive.level,
          phase: { answer: action.answer, feedback: action.feedback, kind: "feedback" },
        };
      case "next":
        return advance({ state, total });
      case "alreadyAnswered":
        return { ...state, phase: { kind: "alreadyAnswered" } };
      case "answerFailed":
        return { ...state, phase: { kind: "answerFailed" } };
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
