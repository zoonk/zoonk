import "server-only";
import { type StudySessionBlock, prisma } from "@zoonk/db";
import { type BlockPayload, getBlockItemIds, readBlockPayload } from "../block-payload";
import { readRecordedAnswer } from "./session-items";

/** A statement left blank ("I don't know") in a net-scored capsule or practice. */
function isBlankAnswer(answer: unknown): boolean {
  const recorded = readRecordedAnswer(answer);
  return recorded !== null && "dontKnow" in recorded;
}

/** Whether a block's question is scored net: in net-scored practice, or in a swipe capsule. */
function isNetScoredItem({ itemId, payload }: { itemId: string; payload: BlockPayload }): boolean {
  const capsule = payload.capsules.find((candidate) => candidate.itemIds.includes(itemId));
  return capsule ? capsule.format === "swipe" : payload.netScored;
}

/**
 * An answer that leaves a net-scored statement blank: neither right nor a mistake, since leaving
 * it blank is how the exam is played when a wrong answer cancels a right one.
 */
export function isLeftBlank({
  answer,
  itemId,
  payload,
}: {
  answer: unknown;
  itemId: string;
  payload: BlockPayload;
}): boolean {
  return isBlankAnswer(answer) && isNetScoredItem({ itemId, payload });
}

/**
 * Cebraspe scoring for swipe capsules and net-scored practice: each wrong answer cancels a right
 * one, and a statement left blank counts for neither, which is why leaving it blank is offered.
 * Null when none of the statements was answered: a net of 0 would read as a result.
 */
export async function getNetScore({
  itemIds,
  sessionId,
  userId,
}: {
  itemIds: string[];
  sessionId: string;
  userId: string;
}): Promise<number | null> {
  const attempts = await prisma.attempt.findMany({
    select: { answer: true, isCorrect: true },
    where: { itemId: { in: itemIds }, studySessionId: sessionId, userId },
  });

  if (attempts.length === 0) {
    return null;
  }

  const right = attempts.filter((attempt) => attempt.isCorrect).length;
  const blank = attempts.filter((attempt) => !attempt.isCorrect && isBlankAnswer(attempt.answer));

  return right - (attempts.length - right - blank.length);
}

/** The questions of a session scored net: net-scored practice and swipe capsules. */
export function getNetScoredItemIds(blocks: readonly StudySessionBlock[]): string[] {
  return blocks.flatMap((block) => {
    const payload = readBlockPayload(block);

    if (payload.netScored) {
      return getBlockItemIds(payload);
    }

    return payload.capsules
      .filter((capsule) => capsule.format === "swipe")
      .flatMap((capsule) => capsule.itemIds);
  });
}
