import "server-only";
import { type StudySessionBlock, type TransactionClient } from "@zoonk/db";
import { type BlockPayload, readBlockPayload } from "../block-payload";

/** Includes legacy active-block start time when no focus clock was recorded. */
export function getBlockElapsedMs({
  block,
  now,
}: {
  block: Pick<StudySessionBlock, "id" | "payload" | "startedAt">;
  now: Date;
}): number {
  const timing = readBlockPayload(block).timing;
  const activeAt = timing ? timing.activeAt : block.startedAt?.toISOString();
  const elapsed = activeAt ? Math.max(0, now.getTime() - new Date(activeAt).getTime()) : 0;
  return (timing?.elapsedMs ?? 0) + elapsed;
}

export function pausedBlockTiming({
  block,
  now,
}: {
  block: StudySessionBlock;
  now: Date;
}): NonNullable<BlockPayload["timing"]> {
  return {
    ...readBlockPayload(block).timing,
    activeAt: null,
    elapsedMs: getBlockElapsedMs({ block, now }),
  };
}

/** Caller holds the progress lock; acquire blocks in id order before any session locks. */
export async function lockStudyBlockClocks({
  blockId,
  tx,
  userId,
}: {
  blockId: string;
  tx: TransactionClient;
  userId: string;
}): Promise<string[]> {
  const blocks = await tx.$queryRaw<{ id: string }[]>`
    SELECT block.id FROM study_session_blocks AS block
    JOIN study_sessions AS session ON session.id = block.session_id
    WHERE session.user_id = ${userId}::uuid
      AND (block.id = ${blockId}::uuid OR block.status = 'active' OR block.payload #>> '{timing,activeAt}' IS NOT NULL)
    ORDER BY block.id FOR UPDATE OF block
  `;

  return blocks.map((block) => block.id);
}

/** Pausing preserves answers and accrued focus time. */
export async function pauseOtherStudyBlocks({
  blockId,
  lockedIds,
  now,
  tx,
}: {
  blockId: string;
  lockedIds: readonly string[];
  now: Date;
  tx: TransactionClient;
}): Promise<void> {
  const blocks = await tx.studySessionBlock.findMany({
    where: { id: { in: lockedIds.filter((id) => id !== blockId) } },
  });

  await Promise.all(
    blocks.map((block) =>
      tx.studySessionBlock.update({
        data: {
          payload: { ...readBlockPayload(block), timing: pausedBlockTiming({ block, now }) },
        },
        where: { id: block.id },
      }),
    ),
  );
}
