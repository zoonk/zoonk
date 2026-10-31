import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { type BlockPayload, readBlockPayload } from "../block-payload";
import { type MissionPick } from "./catalog";

export type BlockMissionResult = NonNullable<BlockPayload["missionResult"]>;

/** Requires the settlement transaction and lock; replays the stored moment or saves this settlement's result once. */
export async function keepBlockMissionResult(
  tx: TransactionClient,
  {
    blockId,
    fullMealPaid,
    newlyDone,
  }: { blockId: string | undefined; fullMealPaid: boolean; newlyDone: readonly MissionPick[] },
): Promise<BlockMissionResult | null> {
  if (!blockId) {
    return null;
  }

  const block = await tx.studySessionBlock.findUnique({
    select: { id: true, payload: true },
    where: { id: blockId },
  });

  const kept = block ? readBlockPayload(block).missionResult : null;

  if (kept) {
    return kept;
  }

  const result = { completed: newlyDone.map((pick) => pick.kind), fullMealPaid };

  if (result.completed.length > 0 || result.fullMealPaid) {
    await tx.$executeRaw`
      UPDATE study_session_blocks
      SET payload = jsonb_set(payload, '{missionResult}', ${JSON.stringify(result)}::jsonb)
      WHERE id = ${blockId}::uuid
    `;
  }

  return result;
}
