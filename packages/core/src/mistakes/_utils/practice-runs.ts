import "server-only";
import { type Attempt, type LearningEvent, type TransactionClient, prisma } from "@zoonk/db";

/** How the learning ledger names a "Practice mistakes" run. */
const MISTAKE_PRACTICE_LEDGER_KIND = "mistakePractice";

/** Answers older than this belong to a run that was left, not to the one being finished. */
const MAX_RUN_AGE_MS = 86_400_000;

/** Time counted per answer at most, so a tab left open doesn't inflate the day. */
const MAX_SECONDS_PER_ANSWER = 180;

const MS_PER_SECOND = 1000;
const ANSWER_ID_SEPARATOR = ",";

export type PracticeAnswer = Pick<
  Attempt,
  "answeredAt" | "durationMs" | "id" | "isCorrect" | "itemId" | "skillId"
>;

/**
 * A run's answers, only when every one is the learner's own recent practice answer: a bank
 * question on the skill (or the question) of one of their mistakes, outside sessions and lessons,
 * which count on their own.
 */
export async function loadPracticeAnswers({
  answerIds,
  userId,
}: {
  answerIds: readonly string[];
  userId: string;
}): Promise<PracticeAnswer[] | null> {
  const ids = [...new Set(answerIds)];

  const answers = await prisma.attempt.findMany({
    orderBy: [{ answeredAt: "asc" }, { id: "asc" }],
    select: {
      answeredAt: true,
      durationMs: true,
      id: true,
      isCorrect: true,
      itemId: true,
      skillId: true,
    },
    where: {
      answeredAt: { gte: new Date(Date.now() - MAX_RUN_AGE_MS) },
      id: { in: ids },
      itemId: { not: null },
      stepId: null,
      studySessionId: null,
      userId,
    },
  });

  if (answers.length !== ids.length) {
    return null;
  }

  const itemIds = answers.flatMap((answer) => (answer.itemId ? [answer.itemId] : []));
  const skillIds = answers.flatMap((answer) => (answer.skillId ? [answer.skillId] : []));

  const mistakes = await prisma.mistake.findMany({
    select: { itemId: true, skillId: true },
    where: { OR: [{ itemId: { in: itemIds } }, { skillId: { in: skillIds } }], userId },
  });

  const practiced = answers.every((answer) =>
    mistakes.some(
      (mistake) =>
        mistake.itemId === answer.itemId ||
        (mistake.skillId !== null && mistake.skillId === answer.skillId),
    ),
  );

  return practiced ? answers : null;
}

/** The answer ids a finished run counted, kept on its ledger row. */
function readRunAnswerIds(event: Pick<LearningEvent, "contentIds">): string[] {
  const { contentIds } = event;

  if (typeof contentIds !== "object" || contentIds === null || !("answerIds" in contentIds)) {
    return [];
  }

  const { answerIds } = contentIds;
  return typeof answerIds === "string" ? answerIds.split(ANSWER_ID_SEPARATOR) : [];
}

export function toRunContentIds(answers: readonly PracticeAnswer[]): Record<string, string> {
  return { answerIds: answers.map((answer) => answer.id).join(ANSWER_ID_SEPARATOR) };
}

/**
 * Runs counted since the first of these answers, read under the progress lock: only rows that ended
 * after it can hold any of them.
 */
export function loadCountedRuns(
  tx: TransactionClient,
  { since, userId }: { since: Date; userId: string },
) {
  return tx.learningEvent.findMany({
    select: {
      brainPower: true,
      contentIds: true,
      correctAnswers: true,
      id: true,
      incorrectAnswers: true,
      seconds: true,
    },
    where: { endedAt: { gte: since }, lessonKind: MISTAKE_PRACTICE_LEDGER_KIND, userId },
  });
}

type CountedRun = Awaited<ReturnType<typeof loadCountedRuns>>[number];

/**
 * Splits a finish into what's new and the run it belongs to: the counted run that already holds
 * some of these answers (a run is finished again as it goes), and the answers no run counted yet.
 */
export function matchRun({
  answers,
  runs,
}: {
  answers: readonly PracticeAnswer[];
  runs: readonly CountedRun[];
}) {
  const ids = new Set(answers.map((answer) => answer.id));
  const counted = new Set(runs.flatMap((run) => readRunAnswerIds(run)));
  const run = runs.find((candidate) => readRunAnswerIds(candidate).some((id) => ids.has(id)));
  const inRun = new Set(run ? readRunAnswerIds(run) : []);

  return {
    fresh: answers.filter((answer) => !counted.has(answer.id)),
    run: run ?? null,
    runAnswers: answers.filter((answer) => inRun.has(answer.id) || !counted.has(answer.id)),
  };
}

/** The run's ledger identity: one `questions` row per "Practice mistakes" run. */
export const MISTAKE_PRACTICE_EVENT = {
  kind: "questions",
  lessonKind: MISTAKE_PRACTICE_LEDGER_KIND,
} as const;

/** From the first question shown to the finish, capped per answer. */
export function getPracticeTime({
  answers,
  endedAt,
}: {
  answers: readonly PracticeAnswer[];
  endedAt: Date;
}): { seconds: number; startedAt: Date } {
  const startedAt = Math.min(
    ...answers.map((answer) => answer.answeredAt.getTime() - answer.durationMs),
  );

  const seconds = Math.round(Math.max(0, endedAt.getTime() - startedAt) / MS_PER_SECOND);

  return {
    seconds: Math.min(seconds, answers.length * MAX_SECONDS_PER_ANSWER),
    startedAt: new Date(startedAt),
  };
}
