import { type StudySessionBlock } from "@zoonk/db";
import { type MissionPick } from "./catalog";
import { getMissionBlocks } from "./mission-blocks";

/**
 * Only the verified block an activity finished can give it credit for a block mission, and only
 * when that block crossed the mission's threshold. `finishedAt`, when the activity keeps its own
 * end, must be the block's completion time.
 */
export function isLinkedBlockMission({
  blockId,
  blocks,
  finishedAt,
  pick,
}: {
  blockId: string;
  blocks: readonly StudySessionBlock[];
  finishedAt?: Date;
  pick: MissionPick;
}): boolean {
  const matching = getMissionBlocks({ blocks, pick });
  const linked = matching.find((block) => block.id === blockId);
  const completedAt = linked?.completedAt;

  if (
    linked?.status !== "completed" ||
    !completedAt ||
    (finishedAt && completedAt.getTime() !== finishedAt.getTime())
  ) {
    return false;
  }

  // A completed broad anchor may already have been satisfied by a different block. Later work
  // cannot claim it; a retry still uses the original block completion time.
  const alreadyDone = matching.filter(
    (block) =>
      block.id !== linked.id &&
      block.status === "completed" &&
      block.completedAt !== null &&
      block.completedAt <= completedAt,
  ).length;

  return alreadyDone === pick.total - 1;
}

/** Only the verified block this call finished can give it credit for a block mission. */
export function isLinkedCallMission({
  blocks,
  call,
  pick,
}: {
  blocks: readonly StudySessionBlock[];
  call: { endedAt: Date | null; studyBlockId: string | null } | null;
  pick: MissionPick;
}): boolean {
  if (!call?.endedAt || !call.studyBlockId) {
    return false;
  }

  return isLinkedBlockMission({
    blockId: call.studyBlockId,
    blocks,
    finishedAt: call.endedAt,
    pick,
  });
}
