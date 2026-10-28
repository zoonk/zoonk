import "server-only";
import { type StudySessionBlock, prisma } from "@zoonk/db";
import { type BlockPayload, getBlockItemIds, readBlockPayload } from "../block-payload";
import { readRecordedAnswer } from "./session-items";

function isBlankAnswer(answer: unknown): boolean {
  const recorded = readRecordedAnswer(answer);
  return recorded !== null && "dontKnow" in recorded;
}

function isNetScoredItem({ itemId, payload }: { itemId: string; payload: BlockPayload }): boolean {
  const capsule = payload.capsules.find((candidate) => candidate.itemIds.includes(itemId));
  return capsule ? capsule.format === "swipe" : payload.netScored;
}

/** Blank net-scored statements are neither right nor mistakes. */
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

/** Blank statements count for neither side; null means no statements answered, rather than a measured zero. */
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
