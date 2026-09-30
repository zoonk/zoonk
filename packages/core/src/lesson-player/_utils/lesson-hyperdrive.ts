import "server-only";
import { prisma } from "@zoonk/db";
import { scoreAnswers } from "../../sessions/brain-power";
import { loadStudySessionAnswers } from "../../sessions/score-lesson-answers";
import { type LibraryLessonRun } from "../contract";

type LessonQuestionRow = { id: string; itemId: string | null };

/**
 * The learner's session that has this lesson as a block, or null for someone else's session or one
 * without it: a stale link still plays the lesson, just outside the session.
 */
export async function findLessonStudySessionId({
  lessonId,
  studySessionId,
  userId,
}: {
  lessonId: string;
  studySessionId: string | undefined;
  userId: string;
}): Promise<string | null> {
  if (!studySessionId) {
    return null;
  }

  const session = await prisma.studySession.findFirst({
    select: { id: true },
    where: { blocks: { some: { lessonId } }, id: studySessionId, userId },
  });

  return session?.id ?? null;
}

/**
 * Screens whose question the learner already got right: a bank item (math checks) or the screen
 * itself. Answering them right again is a repeat, which keeps Hyperdrive where it is.
 */
async function getKnownStepIds({
  steps,
  userId,
}: {
  steps: readonly LessonQuestionRow[];
  userId: string;
}): Promise<string[]> {
  const itemIds = steps.flatMap((step) => (step.itemId ? [step.itemId] : []));

  const rightAnswers = await prisma.attempt.findMany({
    distinct: ["stepId", "itemId"],
    select: { itemId: true, stepId: true },
    where: {
      OR: [{ stepId: { in: steps.map((step) => step.id) } }, { itemId: { in: itemIds } }],
      isCorrect: true,
      userId,
    },
  });

  const known = new Set(rightAnswers.flatMap((answer) => [answer.itemId, answer.stepId]));

  return steps
    .filter((step) => (step.itemId ? known.has(step.itemId) : known.has(step.id)))
    .map((step) => step.id);
}

/**
 * Where Hyperdrive starts for a run, so the player shows it live with the same rule the server
 * scores by (`advanceHyperdrive`): the session's streak so far and the screens that would be repeats.
 */
export async function getRunHyperdrive({
  lessonId,
  studySessionId,
  userId,
}: {
  lessonId: string;
  studySessionId: string | null;
  userId: string;
}): Promise<LibraryLessonRun["hyperdrive"]> {
  const steps = await prisma.step.findMany({
    select: { id: true, itemId: true },
    where: { lessonId },
  });

  const [knownStepIds, sessionAnswers] = await Promise.all([
    getKnownStepIds({ steps, userId }),
    loadStudySessionAnswers({ studySessionId, userId }),
  ]);

  return { knownStepIds, streak: scoreAnswers({ answers: sessionAnswers }).streak };
}
