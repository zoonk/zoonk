import "server-only";
import { type Attempt, prisma } from "@zoonk/db";
import { type LessonStepCheckResult } from "../contract";
import { type LessonAnswerVerdict } from "./grade-lesson-answer";
import { getScreenComesBack } from "./plan-skill-review";

/** A graded answer as its screen shows it: the verdict, a saved mistake and when the idea comes back. */
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

/**
 * When the screen's idea comes back (see `getScreenComesBack`). A quick explanation never comes
 * back in a review (reviews come with a study plan's sessions, which explanations aren't part of),
 * so its screens don't say when their skill does.
 */
export function getComesBack({
  explanation,
  ownDue,
  ...input
}: ComesBackInput & { ownDue: Date | null }): Promise<Date | null> | null {
  return explanation ? null : getScreenComesBack({ ...input, ownDue });
}

/**
 * An answer past the run's cap, or a written one nothing checked, isn't recorded: the verdict,
 * with when the idea already comes back and no new mistake. An answer sent again says whether it
 * saved a mistake the first time.
 */
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

/**
 * An answer sent again (a retry after a dropped response) isn't recorded twice: it gets the verdict
 * it was saved with and whether it saved a mistake, which a miss always does when its screen has a
 * question for the notebook (a new entry, or the one the question already has there). The code's
 * words come with it when `verdict` is the code's (`fromCode`) and grades it the same; a written
 * answer a model graded keeps its saved verdict and score without the model's words, which aren't
 * kept, and never with the words of another request's model.
 */
export function checkSaved({
  fromCode,
  hasQuestion,
  saved,
  verdict,
  ...input
}: Parameters<typeof checkWithoutRecording>[0] & {
  fromCode: boolean;
  hasQuestion: boolean;
  saved: Pick<Attempt, "isCorrect" | "score">;
}) {
  const sameAsCode = fromCode && verdict.checked && verdict.isCorrect === saved.isCorrect;

  const savedVerdict: LessonAnswerVerdict = sameAsCode
    ? { ...verdict, score: saved.score }
    : {
        ...verdict,
        checked: true,
        corrections: [],
        feedback: null,
        isCorrect: saved.isCorrect,
        keyPoints: null,
        score: saved.score,
        spelling: null,
      };

  return checkWithoutRecording({
    ...input,
    savedMistake: !saved.isCorrect && hasQuestion,
    verdict: savedVerdict,
  });
}
