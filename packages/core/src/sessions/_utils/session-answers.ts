import "server-only";
import { type Attempt, type StudySessionBlock, prisma } from "@zoonk/db";
import { classifyAnswers } from "../answer-material";
import { getBlockItemIds, readBlockPayload } from "../block-payload";
import { type ScoredAnswer } from "../brain-power";

export type SessionAnswer = Pick<
  Attempt,
  "answeredAt" | "durationMs" | "id" | "isCorrect" | "itemId" | "skillId" | "stepId"
> &
  ScoredAnswer;

const ANSWER_SELECT = {
  answeredAt: true,
  durationMs: true,
  id: true,
  isCorrect: true,
  itemId: true,
  skillId: true,
  stepId: true,
} as const;

/** Capsule and drill questions are due today; they build Hyperdrive like new material. */
export function getDueItemIds(blocks: readonly StudySessionBlock[]): Set<string> {
  return new Set(
    blocks.flatMap((block) => {
      const payload = readBlockPayload(block);

      return [
        ...payload.capsules.flatMap((capsule) => capsule.itemIds),
        ...payload.drills.flatMap((drill) => drill.itemIds),
      ];
    }),
  );
}

/**
 * Every answer given in a session, lessons included, in order and classified for Brain Power: due,
 * new, or a repeat of something already answered right.
 */
export async function loadSessionAnswers({
  blocks,
  sessionId,
  userId,
}: {
  blocks: readonly StudySessionBlock[];
  sessionId: string;
  userId: string;
}): Promise<SessionAnswer[]> {
  const answers = await prisma.attempt.findMany({
    orderBy: { answeredAt: "asc" },
    select: ANSWER_SELECT,
    where: { studySessionId: sessionId, userId },
  });

  const itemIds = answers.flatMap((answer) => (answer.itemId ? [answer.itemId] : []));
  const stepIds = answers.flatMap((answer) => (answer.stepId ? [answer.stepId] : []));

  const history =
    answers.length === 0
      ? []
      : await prisma.attempt.findMany({
          select: ANSWER_SELECT,
          where: {
            OR: [{ itemId: { in: itemIds } }, { stepId: { in: stepIds } }],
            isCorrect: true,
            userId,
          },
        });

  return classifyAnswers({ answers, dueItemIds: getDueItemIds(blocks), history });
}

/** The answers that belong to one question block of the session. */
export function getBlockAnswers({
  answers,
  block,
}: {
  answers: readonly SessionAnswer[];
  block: StudySessionBlock;
}): SessionAnswer[] {
  const itemIds = new Set(getBlockItemIds(readBlockPayload(block)));
  return answers.filter((answer) => answer.itemId !== null && itemIds.has(answer.itemId));
}
