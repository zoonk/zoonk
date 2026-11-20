import "server-only";
import { prisma } from "@zoonk/db";
import { type FixedRow, findRowsFixedSince } from "../../staff/content-fixes/fixed-since";
import { NOT_CHECKED } from "./check-results";
import { type LessonAnswerVerdict } from "./grade-lesson-answer";

type Screen = {
  id: string;
  lessonId: string;
  retiredAt: Date | null;
  sentenceId: string | null;
  wordId: string | null;
};

/**
 * A word screen grades the pick of its own word by id, so another word's fix, which changes only
 * the wrong options shown with it, never makes a right pick wrong.
 */
function rowsOf({ id, lessonId, sentenceId, wordId }: Screen): FixedRow[] {
  return [
    { id, model: "Step" },
    ...(wordId
      ? [
          { id: wordId, model: "Word" },
          { id: wordId, lessonId, model: "LessonWord" },
        ]
      : []),
    ...(sentenceId
      ? [
          { id: sentenceId, model: "Sentence" },
          { id: sentenceId, lessonId, model: "LessonSentence" },
        ]
      : []),
  ];
}

async function missingLessonRows(screens: readonly Screen[]): Promise<string[]> {
  const retired = screens.filter(
    (screen) => screen.retiredAt && (screen.wordId || screen.sentenceId),
  );
  const words = retired.flatMap(({ lessonId, wordId }) => (wordId ? [{ lessonId, wordId }] : []));
  const sentences = retired.flatMap(({ lessonId, sentenceId }) =>
    sentenceId ? [{ lessonId, sentenceId }] : [],
  );
  const [linkedWords, linkedSentences] = await Promise.all([
    words.length
      ? prisma.lessonWord.findMany({
          select: { lessonId: true, wordId: true },
          where: { OR: words },
        })
      : [],
    sentences.length
      ? prisma.lessonSentence.findMany({
          select: { lessonId: true, sentenceId: true },
          where: { OR: sentences },
        })
      : [],
  ]);
  return retired
    .filter(
      (screen) =>
        (screen.wordId &&
          !linkedWords.some(
            (word) => word.lessonId === screen.lessonId && word.wordId === screen.wordId,
          )) ||
        (screen.sentenceId &&
          !linkedSentences.some(
            (sentence) =>
              sentence.lessonId === screen.lessonId && sentence.sentenceId === screen.sentenceId,
          )),
    )
    .map((screen) => screen.id);
}

/**
 * The screens a content fix changed during a run that started at `startedAt`: their own content,
 * one of their versions, or the word or sentence they show. Answers to them aren't held against
 * the learner, who may still be looking at the old screen.
 */
export async function findFixedScreenIds({
  screens,
  startedAt,
}: {
  screens: readonly Screen[];
  startedAt: Date;
}): Promise<Set<string>> {
  if (screens.length === 0) {
    return new Set();
  }

  const variants = await prisma.stepVariant.findMany({
    select: { id: true, stepId: true },
    where: { stepId: { in: screens.map((screen) => screen.id) } },
  });

  const owners = [
    ...screens.flatMap((screen) => rowsOf(screen).map((row) => ({ row, stepId: screen.id }))),
    ...variants.map((variant) => ({
      row: { id: variant.id, model: "StepVariant" },
      stepId: variant.stepId,
    })),
  ];

  const [fixed, missing] = await Promise.all([
    findRowsFixedSince({ rows: owners.map((owner) => owner.row), startedAt }),
    missingLessonRows(screens),
  ]);

  return new Set([
    ...missing,
    ...owners.filter((owner) => fixed.includes(owner.row)).map((owner) => owner.stepId),
  ]);
}

/**
 * The learner may still be looking at the screen as it was before a fix, so an answer that isn't
 * right now is neither counted nor shown as wrong, and nothing is saved. Null when it stands.
 */
export async function excuseFixedAnswer({
  run,
  screen,
  verdict,
}: {
  run: { startedAt: Date };
  screen: Screen;
  verdict: LessonAnswerVerdict | null;
}): Promise<LessonAnswerVerdict | null> {
  if (verdict?.isCorrect) {
    return null;
  }

  const fixed = await findFixedScreenIds({ screens: [screen], startedAt: run.startedAt });

  return fixed.has(screen.id) ? { ...NOT_CHECKED, answerText: verdict?.answerText ?? null } : null;
}
