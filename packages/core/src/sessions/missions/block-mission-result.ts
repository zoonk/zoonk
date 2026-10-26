import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { type BlockPayload, readBlockPayload } from "../block-payload";
import { type MissionPick } from "./catalog";

/** What finishing a session block did to the day's missions: the ones it completed and the bonus. */
export type BlockMissionResult = NonNullable<BlockPayload["missionResult"]>;

/**
 * The finished block's result: the one an earlier finish kept (read under the settlement's lock, so
 * a finish that overlaps it or comes after it says the same), or this settlement's, kept on the
 * block in the settlement's own transaction when it completed a mission or paid the bonus. Null
 * for a settlement no block finished.
 */
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
