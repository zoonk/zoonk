import { type LessonStepCheckResult } from "@zoonk/core/lesson-player/contract";
import { type GradedStepAnswer } from "@zoonk/core/lesson-player/grade";
import { type SpokenAnswerGrade } from "@zoonk/core/library/language/spoken-answer-contract";
import { type LessonStepResult, type PlayableLibraryStep } from "../lesson-player-types";

/** A verdict reached on the device; the server adds when the idea comes back. */
export function fromLocalGrade(graded: GradedStepAnswer): LessonStepResult {
  return {
    answerText: graded.answerText,
    checked: true,
    correctAnswer: graded.correctAnswer,
    corrections: [],
    feedback: graded.feedback,
    heard: null,
    isCorrect: graded.isCorrect,
    keyPoints: null,
    nextReviewAt: null,
    savedMistake: false,
    score: null,
    spelling: null,
  };
}

export function fromServerCheck({
  answerText,
  result,
}: {
  answerText: string;
  result: LessonStepCheckResult;
}): LessonStepResult {
  return { ...result, answerText, heard: null };
}

/** How a recording came out: the grader's words and explanation, and the sentence when missed. */
export function fromSpokenGrade({
  grade,
  step,
}: {
  grade: SpokenAnswerGrade;
  step: PlayableLibraryStep;
}): LessonStepResult {
  const target = step.kind === "spokenAnswer" ? step.content.targetText : null;

  return {
    answerText: grade.transcript,
    checked: true,
    correctAnswer: grade.isCorrect ? null : target,
    corrections: [],
    feedback: grade.explanation,
    heard: {
      transcript: grade.transcript,
      words: grade.words,
      wordsToPractice: grade.wordsToPractice,
    },
    isCorrect: grade.isCorrect,
    keyPoints: null,
    nextReviewAt: null,
    savedMistake: false,
    score: grade.score,
    spelling: null,
  };
}

/** A hook's guess reveals the answer whatever the pick; the reveal is the why. */
export function revealGuess({
  optionId,
  step,
}: {
  optionId: string;
  step: PlayableLibraryStep;
}): LessonStepResult | null {
  if (step.kind !== "hook" || step.content.variant !== "guess") {
    return null;
  }

  const picked = step.content.options.find((option) => option.id === optionId);
  const right = step.content.options.find((option) => option.isCorrect);

  if (!picked) {
    return null;
  }

  return {
    answerText: picked.text,
    checked: true,
    correctAnswer: picked.isCorrect ? null : (right?.text ?? null),
    corrections: [],
    feedback: step.content.reveal,
    heard: null,
    isCorrect: picked.isCorrect,
    keyPoints: null,
    nextReviewAt: null,
    savedMistake: false,
    score: null,
    spelling: null,
  };
}
