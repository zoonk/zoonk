import { type LessonPlayerState, getCurrentStep } from "../lesson-player-state";
import { type LessonStepResult } from "../lesson-player-types";

function fromSampleAnswer(sampleAnswer: string): LessonStepResult {
  return {
    answerText: null,
    checked: false,
    correctAnswer: sampleAnswer,
    corrections: [],
    feedback: null,
    heard: null,
    isCorrect: false,
    keyPoints: null,
    nextReviewAt: null,
    savedMistake: false,
    score: null,
    spelling: null,
  };
}

export function showSampleAnswer(state: LessonPlayerState, stepId: string): LessonPlayerState {
  const step = getCurrentStep(state);

  if (state.phase !== "playing" || step?.id !== stepId || step.kind !== "typedAnswer") {
    return state;
  }

  return {
    ...state,
    checkFailed: false,
    checkIssue: null,
    notice: null,
    phase: "feedback",
    results: { ...state.results, [stepId]: fromSampleAnswer(step.content.sampleAnswer) },
    skippedWritingStepIds: [...new Set([...state.skippedWritingStepIds, stepId])],
  };
}
