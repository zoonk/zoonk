import "server-only";
import { type StudySessionBlock, type TransactionClient } from "@zoonk/db";
import { type BlockPayload, readBlockPayload } from "../block-payload";
import { type MissionPick } from "./catalog";

export type BlockMissionResult = NonNullable<BlockPayload["missionResult"]>;

type SessionBlock = Pick<StudySessionBlock, "completedAt" | "id" | "payload" | "status">;

function readKept(block: SessionBlock | undefined): BlockMissionResult | null {
  return block ? readBlockPayload(block).missionResult : null;
}

function finishedAt(block: SessionBlock | undefined): number {
  return block?.status === "completed" ? (block.completedAt?.getTime() ?? 0) : 0;
}

/**
 * Mission progress counts finished blocks, so what a settlement finds newly done is the last
 * finish's work, whichever block's settlement reaches the day first. A tie keeps the settling block.
 */
function findMomentOwner({
  blockId,
  blocks,
}: {
  blockId: string;
  blocks: readonly SessionBlock[];
}) {
  const settling = blocks.find((block) => block.id === blockId);

  const last = blocks.reduce(
    (latest, block) => (finishedAt(block) > finishedAt(latest) ? block : latest),
    settling,
  );

  return last?.id ?? blockId;
}

/**
 * Requires the settlement transaction and lock, and `blocks` read under them. Saves this
 * settlement's result once, on the block that finished last, and replays `blockId`'s saved moment.
 */
export async function keepBlockMissionResult(
  tx: TransactionClient,
  {
    blockId,
    blocks,
    fullMealPaid,
    newlyDone,
  }: {
    blockId: string | undefined;
    blocks: readonly SessionBlock[];
    fullMealPaid: boolean;
    newlyDone: readonly MissionPick[];
  },
): Promise<BlockMissionResult | null> {
  if (!blockId) {
    return null;
  }

  const kept = readKept(blocks.find((block) => block.id === blockId));

  if (kept) {
    return kept;
  }

  const owner = findMomentOwner({ blockId, blocks });
  const result = { completed: newlyDone.map((pick) => pick.kind), fullMealPaid };
  const changed = result.completed.length > 0 || result.fullMealPaid;

  if (changed && !readKept(blocks.find((block) => block.id === owner))) {
    await tx.$executeRaw`
      UPDATE study_session_blocks
      SET payload = jsonb_set(payload, '{missionResult}', ${JSON.stringify(result)}::jsonb)
      WHERE id = ${owner}::uuid
    `;
  }

  return owner === blockId ? result : { completed: [], fullMealPaid: false };
}
