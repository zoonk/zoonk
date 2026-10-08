import "server-only";
import { prisma } from "@zoonk/db";
import { CURRENT_STEPS } from "../../library/lessons/lesson-versions";
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
 * Screens whose question the learner got right before the run: a bank item (math checks) or the
 * screen itself. Answering them right again is a repeat, which keeps Hyperdrive where it is.
 */
async function getKnownStepIds({
  before,
  steps,
  userId,
}: {
  before: Date;
  steps: readonly LessonQuestionRow[];
  userId: string;
}): Promise<string[]> {
  const itemIds = steps.flatMap((step) => (step.itemId ? [step.itemId] : []));

  const rightAnswers = await prisma.attempt.findMany({
    distinct: ["stepId", "itemId"],
    select: { itemId: true, stepId: true },
    where: {
      OR: [{ stepId: { in: steps.map((step) => step.id) } }, { itemId: { in: itemIds } }],
      answeredAt: { lt: before },
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
 * Where Hyperdrive starts for a run, by the same rule the server scores with: the session's streak
 * and the screens that would be repeats, both as they were when the run started, so a resumed run
 * replays its own answers on top of them.
 */
export async function getRunHyperdrive({
  lessonId,
  run,
  studySessionId,
  userId,
}: {
  lessonId: string;
  run: { startedAt: Date };
  studySessionId: string | null;
  userId: string;
}): Promise<LibraryLessonRun["hyperdrive"]> {
  const steps = await prisma.step.findMany({
    select: { id: true, itemId: true },
    where: { lessonId, ...CURRENT_STEPS },
  });

  const [knownStepIds, sessionAnswers] = await Promise.all([
    getKnownStepIds({ before: run.startedAt, steps, userId }),
    loadStudySessionAnswers({ studySessionId, userId }),
  ]);

  const earlier = sessionAnswers.filter((answer) => answer.answeredAt < run.startedAt);

  return { knownStepIds, streak: scoreAnswers({ answers: earlier }).streak };
}
