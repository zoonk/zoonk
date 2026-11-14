import "server-only";
import { type Attempt } from "@zoonk/db";
import { type LessonStepCheckResult } from "../contract";
import { type LessonAnswerVerdict } from "./grade-lesson-answer";

export const NOT_CHECKED: LessonAnswerVerdict = {
  answerText: null,
  checked: false,
  correctAnswer: null,
  corrections: [],
  expected: null,
  feedback: null,
  isCorrect: false,
  keyPoints: null,
  score: null,
  spelling: null,
};

export function toCheckResult({
  savedMistake,
  verdict,
}: {
  savedMistake: boolean;
  verdict: LessonAnswerVerdict;
}): LessonStepCheckResult {
  return {
    checked: verdict.checked,
    correctAnswer: verdict.correctAnswer,
    corrections: verdict.corrections,
    expected: verdict.expected,
    feedback: verdict.feedback,
    isCorrect: verdict.isCorrect,
    keyPoints: verdict.keyPoints,
    savedMistake,
    score: verdict.score,
    spelling: verdict.spelling,
  };
}

type SavedVerdict = Pick<Attempt, "isCorrect" | "score">;

/** The saved verdict wins; model feedback is not persisted and must never come from another request. */
export function toSavedVerdict({
  fromCode,
  saved,
  verdict,
}: {
  fromCode: boolean;
  saved: SavedVerdict;
  verdict: LessonAnswerVerdict;
}): LessonAnswerVerdict {
  const sameAsCode = fromCode && verdict.checked && verdict.isCorrect === saved.isCorrect;

  if (sameAsCode) {
    return { ...verdict, score: saved.score };
  }

  return {
    ...verdict,
    checked: true,
    correctAnswer: saved.isCorrect ? null : verdict.correctAnswer,
    corrections: [],
    feedback: null,
    isCorrect: saved.isCorrect,
    keyPoints: null,
    score: saved.score,
    spelling: null,
  };
}

export function checkSaved({
  fromCode,
  hasQuestion,
  saved,
  verdict,
}: {
  fromCode: boolean;
  hasQuestion: boolean;
  saved: SavedVerdict;
  verdict: LessonAnswerVerdict;
}): LessonStepCheckResult {
  return toCheckResult({
    savedMistake: !saved.isCorrect && hasQuestion,
    verdict: toSavedVerdict({ fromCode, saved, verdict }),
  });
}
