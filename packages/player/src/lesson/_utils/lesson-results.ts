import { type LessonStepCheckResult } from "@zoonk/core/lesson-player/contract";
import { type GradedStepAnswer } from "@zoonk/core/lesson-player/grade";
import { type SpokenAnswerGrade } from "@zoonk/core/library/language/spoken-answer-contract";
import { type LessonStepResult, type PlayableLibraryStep } from "../lesson-player-types";

export function fromLocalGrade(graded: GradedStepAnswer): LessonStepResult {
  return {
    answerText: graded.answerText,
    checked: true,
    correctAnswer: graded.correctAnswer,
    corrections: [],
    expected: graded.expected,
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
    expected: null,
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
    expected: null,
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
