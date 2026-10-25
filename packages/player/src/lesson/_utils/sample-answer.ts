import { type LessonPlayerState, getCurrentStep } from "../lesson-player-state";
import { type LessonStepResult } from "../lesson-player-types";

/** No verdict on an answer the learner didn't give: only the sample answer, to read. */
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

/**
 * "I don't know yet" on a written answer: its sample answer shows as the screen's result, to read
 * before going on. Like writing skipped, it leaves the screen out of the lesson's answers, so it
 * counts neither way and doesn't come back at the end.
 */
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
