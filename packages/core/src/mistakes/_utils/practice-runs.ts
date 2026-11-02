import "server-only";
import { type Attempt, type LearningEvent, type TransactionClient, prisma } from "@zoonk/db";

const MISTAKE_PRACTICE_LEDGER_KIND = "mistakePractice";

/** Answers from an abandoned day-old run must not join a new run's finish. */
const MAX_RUN_AGE_MS = 86_400_000;

/** Cap idle answer time so an abandoned tab cannot inflate the study day. */
const MAX_SECONDS_PER_ANSWER = 180;

const MS_PER_SECOND = 1000;
const ANSWER_ID_SEPARATOR = ",";

export type PracticeAnswer = Pick<
  Attempt,
  "answeredAt" | "durationMs" | "id" | "isCorrect" | "itemId" | "skillId"
>;

/** Returns answers only if every id belongs to the learner's recent standalone mistake practice. */
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

function readRunAnswerIds(event: Pick<LearningEvent, "contentIds">): string[] {
  const { contentIds } = event;

  if (typeof contentIds !== "object" || contentIds === null || !("answerIds" in contentIds)) {
    return [];
  }

  const { answerIds } = contentIds;
  return typeof answerIds === "string" ? answerIds.split(ANSWER_ID_SEPARATOR) : [];
}

export function readFixedMistakeIds(answer: Attempt["answer"]): string[] {
  if (typeof answer !== "object" || answer === null || Array.isArray(answer)) {
    return [];
  }

  if (answer.dontKnow === true || !Array.isArray(answer.fixedMistakeIds)) {
    return [];
  }

  return answer.fixedMistakeIds.filter((id): id is string => typeof id === "string");
}

/** Only server-recorded corrections may satisfy missions; reopened or later-fixed entries cannot prove this run's contribution. */
export async function hasPracticeRunCorrection({
  from,
  runId,
  through,
  tx,
  userId,
}: {
  from: Date;
  runId: string;
  through: Date;
  tx: TransactionClient;
  userId: string;
}): Promise<boolean> {
  const run = await tx.learningEvent.findFirst({
    select: { contentIds: true },
    where: { id: runId, lessonKind: MISTAKE_PRACTICE_LEDGER_KIND, userId },
  });

  if (!run) {
    return false;
  }

  const answers = await tx.attempt.findMany({
    select: { answer: true, answeredAt: true },
    where: {
      answeredAt: { gte: from, lte: through },
      id: { in: readRunAnswerIds(run) },
      isCorrect: true,
      stepId: null,
      studySessionId: null,
      userId,
    },
  });

  const corrections = answers.flatMap((answer) =>
    readFixedMistakeIds(answer.answer).map((id) => ({ fixedAt: answer.answeredAt, id })),
  );

  if (corrections.length === 0) {
    return false;
  }

  return (await tx.mistake.count({ where: { OR: corrections, status: "fixed", userId } })) > 0;
}

export function toRunContentIds(answers: readonly PracticeAnswer[]): Record<string, string> {
  return { answerIds: answers.map((answer) => answer.id).join(ANSWER_ID_SEPARATOR) };
}

/** Caller must hold the progress lock. */
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

/** Counted answers are excluded; overlapping answers identify the existing run to extend. */
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

export const MISTAKE_PRACTICE_EVENT = {
  kind: "questions",
  lessonKind: MISTAKE_PRACTICE_LEDGER_KIND,
} as const;

/** Time starts when the first question was shown and is capped per answer. */
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
