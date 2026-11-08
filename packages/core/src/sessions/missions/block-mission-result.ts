import "server-only";
import { type StudySessionBlock, type TransactionClient } from "@zoonk/db";
import { type BlockPayload, readBlockPayload } from "../block-payload";
import { type MissionPick } from "./catalog";

export type BlockMissionResult = NonNullable<BlockPayload["missionResult"]>;

/** Read under the settlement's lock: a kept result means this block's finish already settled. */
export function readBlockMissionResult({
  blockId,
  blocks,
}: {
  blockId: string | undefined;
  blocks: readonly Pick<StudySessionBlock, "id" | "payload">[];
}): BlockMissionResult | null {
  const block = blocks.find((row) => row.id === blockId);
  return block ? readBlockPayload(block).missionResult : null;
}

/** Requires the settlement transaction and lock; keeps even an empty result as proof the finish settled. */
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

  const result = { completed: newlyDone.map((pick) => pick.kind), fullMealPaid };

  await tx.$executeRaw`
    UPDATE study_session_blocks
    SET payload = jsonb_set(payload, '{missionResult}', ${JSON.stringify(result)}::jsonb)
    WHERE id = ${blockId}::uuid
  `;

  return result;
}
