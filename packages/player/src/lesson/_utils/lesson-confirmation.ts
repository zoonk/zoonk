import {
  type LessonPlayerAction,
  type LessonPlayerState,
  getCurrentStep,
} from "../lesson-player-state";
import { type LessonStepResult } from "../lesson-player-types";

type Confirmation = Extract<LessonPlayerAction, { type: "checkConfirmed" }>;

export function confirmCheck(state: LessonPlayerState, action: Confirmation): LessonPlayerState {
  const confirmed =
    state.firstVerdictAttemptIds[action.stepId] === action.attemptId
      ? {
          ...state,
          firstVerdicts: { ...state.firstVerdicts, [action.stepId]: action.result.isCorrect },
        }
      : state;

  const pending = state.selfCorrection;

  if (
    action.result.isCorrect &&
    pending?.stepId === action.stepId &&
    pending.result.attemptId === action.attemptId &&
    state.notice === "selfCorrect" &&
    state.phase === "playing" &&
    getCurrentStep(state)?.id === action.stepId
  ) {
    return {
      ...confirmed,
      notice: null,
      phase: "feedback",
      results: { ...state.results, [action.stepId]: confirmResult(pending.result, action.result) },
      selfCorrection: null,
    };
  }

  const current = state.results[action.stepId];

  if (!current || current.attemptId !== action.attemptId) {
    return confirmed;
  }

  return {
    ...confirmed,
    results: { ...state.results, [action.stepId]: confirmResult(current, action.result) },
  };
}

function confirmResult(
  current: LessonStepResult,
  verdict: Confirmation["result"],
): LessonStepResult {
  const saved = {
    ...current,
    nextReviewAt: verdict.nextReviewAt,
    savedMistake: verdict.savedMistake,
  };

  return current.isCorrect === verdict.isCorrect
    ? saved
    : {
        ...saved,
        correctAnswer: verdict.isCorrect
          ? verdict.correctAnswer
          : (verdict.correctAnswer ?? current.correctAnswer),
        feedback: verdict.feedback ?? current.feedback,
        isCorrect: verdict.isCorrect,
      };
}
