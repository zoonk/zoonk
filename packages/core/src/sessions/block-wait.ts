import { type StudyBlockKind, type StudyBlockStatus, type StudySessionBlock } from "@zoonk/db";
import { type BlockCheckpoint, readBlockPayload } from "./block-payload";

/** What a block of the day says about itself, as the session's view has it. */
type BlockWaitFields = {
  checkpoint: Pick<BlockCheckpoint, "kind" | "mock"> | null;
  kind: StudyBlockKind;
  position: number;
  status: StudyBlockStatus;
};

/** A phase's challenge with the Trickster (its first duel or a rematch), not the week's or a mock. */
function isPhaseChallenge(block: Pick<BlockWaitFields, "checkpoint">): boolean {
  return block.checkpoint !== null && !block.checkpoint.mock && block.checkpoint.kind !== "weekly";
}

function isUnfinished(block: Pick<BlockWaitFields, "status">): boolean {
  return block.status === "pending" || block.status === "active";
}

/**
 * Why a block of the day can't be opened yet, when the learner picks it out of the day's order:
 * a phase's challenge asks about what the lessons before it teach (a rematch, its reinforcement
 * lessons), so it waits for them (`"lessons"`), and a later phase's challenge waits for the one
 * before it (`"challenge"`). Every other block opens in any order (null).
 */
export function getBlockWait<Block extends BlockWaitFields>({
  block,
  blocks,
}: {
  block: Block;
  blocks: readonly Block[];
}): "challenge" | "lessons" | null {
  if (!isPhaseChallenge(block) || !isUnfinished(block)) {
    return null;
  }

  const before = blocks.filter((other) => other.position < block.position && isUnfinished(other));

  if (before.some((other) => other.kind === "learn")) {
    return "lessons";
  }

  return before.some((other) => isPhaseChallenge(other)) ? "challenge" : null;
}

type StoredWaitInput = Pick<StudySessionBlock, "kind" | "payload" | "position" | "status">;

function toBlockWaitFields(row: StoredWaitInput): BlockWaitFields {
  return {
    checkpoint: readBlockPayload(row).checkpoint,
    kind: row.kind,
    position: row.position,
    status: row.status,
  };
}

/** The same ordering rule for stored blocks, before a start writes or a view is returned. */
export function getStoredBlockWait({
  block,
  blocks,
}: {
  block: StoredWaitInput;
  blocks: readonly StoredWaitInput[];
}): ReturnType<typeof getBlockWait> {
  return getBlockWait({
    block: toBlockWaitFields(block),
    blocks: blocks.map((row) => toBlockWaitFields(row)),
  });
}
