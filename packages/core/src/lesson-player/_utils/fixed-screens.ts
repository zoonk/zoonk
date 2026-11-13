import "server-only";
import { prisma } from "@zoonk/db";
import { type FixedRow, findRowsFixedSince } from "../../staff/content-fixes/fixed-since";
import { NOT_CHECKED } from "./check-results";
import { type LessonAnswerVerdict } from "./grade-lesson-answer";

type Screen = { id: string; sentenceId: string | null; wordId: string | null };

function rowsOf(screen: Screen): FixedRow[] {
  return [
    { id: screen.id, model: "Step" },
    ...(screen.wordId ? [{ id: screen.wordId, model: "Word" }] : []),
    ...(screen.sentenceId ? [{ id: screen.sentenceId, model: "Sentence" }] : []),
  ];
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

  const fixed = await findRowsFixedSince({ rows: owners.map((owner) => owner.row), startedAt });

  return new Set(owners.filter((owner) => fixed.includes(owner.row)).map((owner) => owner.stepId));
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
