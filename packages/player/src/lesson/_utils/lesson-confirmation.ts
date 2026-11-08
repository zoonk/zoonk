import {
  type LessonPlayerAction,
  type LessonPlayerState,
  getCurrentStep,
} from "../lesson-player-state";
import { type LessonStepResult, type PlayableLibraryStep } from "../lesson-player-types";
import { countVerdict, takeBackMiss } from "./lesson-misses";

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
  const step = state.steps[action.stepId];

  if (
    action.result.isCorrect &&
    pending?.stepId === action.stepId &&
    pending.result.attemptId === action.attemptId &&
    state.notice === "selfCorrect" &&
    state.phase === "playing" &&
    getCurrentStep(state)?.id === action.stepId &&
    step
  ) {
    return {
      ...confirmed,
      ...countVerdict(state, { isCorrect: true, step }),
      notice: null,
      phase: "feedback",
      results: { ...state.results, [action.stepId]: confirmResult(pending.result, action.result) },
      selfCorrection: null,
    };
  }

  const current = state.results[action.stepId];

  if (!current || current.attemptId !== action.attemptId || !step) {
    return confirmed;
  }

  return {
    ...confirmed,
    ...recountFlip({
      isCorrect: action.result.isCorrect,
      state,
      step,
      wasCorrect: current.isCorrect,
    }),
    results: { ...state.results, [action.stepId]: confirmResult(current, action.result) },
  };
}

function recountFlip({
  isCorrect,
  state,
  step,
  wasCorrect,
}: {
  isCorrect: boolean;
  state: LessonPlayerState;
  step: PlayableLibraryStep;
  wasCorrect: boolean;
}) {
  if (isCorrect === wasCorrect) {
    return {};
  }

  return isCorrect ? takeBackMiss(state, step.id) : countVerdict(state, { isCorrect, step });
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
