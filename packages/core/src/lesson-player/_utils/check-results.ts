import "server-only";
import { type Attempt, prisma } from "@zoonk/db";
import { type LessonStepCheckResult } from "../contract";
import { type LessonAnswerVerdict } from "./grade-lesson-answer";
import { getScreenComesBack } from "./plan-skill-review";

export function toCheckResult({
  nextReviewAt,
  savedMistake,
  verdict,
}: {
  nextReviewAt: Date | null;
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
    nextReviewAt: nextReviewAt?.toISOString() ?? null,
    savedMistake,
    score: verdict.score,
    spelling: verdict.spelling,
  };
}

export type ComesBackInput = Omit<Parameters<typeof getScreenComesBack>[0], "ownDue"> & {
  explanation: boolean;
};

/** Quick explanations do not participate in session reviews and return no review date. */
export function getComesBack({
  explanation,
  ownDue,
  ...input
}: ComesBackInput & { ownDue: Date | null }): Promise<Date | null> | null {
  return explanation ? null : getScreenComesBack({ ...input, ownDue });
}

/** Performs no writes; savedMistake may replay the outcome of a previously recorded answer. */
export async function checkWithoutRecording({
  savedMistake = false,
  skillId,
  verdict,
  ...comesBack
}: ComesBackInput & {
  savedMistake?: boolean;
  skillId: string | null;
  verdict: LessonAnswerVerdict;
}): Promise<LessonStepCheckResult> {
  const learnerSkill =
    skillId && !comesBack.explanation
      ? await prisma.learnerSkill.findFirst({
          select: { due: true },
          where: { skillId, userId: comesBack.userId },
        })
      : null;

  return toCheckResult({
    nextReviewAt: await getComesBack({ ...comesBack, ownDue: learnerSkill?.due ?? null }),
    savedMistake,
    verdict,
  });
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
  ...input
}: Parameters<typeof checkWithoutRecording>[0] & {
  fromCode: boolean;
  hasQuestion: boolean;
  saved: SavedVerdict;
}) {
  return checkWithoutRecording({
    ...input,
    savedMistake: !saved.isCorrect && hasQuestion,
    verdict: toSavedVerdict({ fromCode, saved, verdict }),
  });
}
