import { type StudySessionBlock } from "@zoonk/db";
import { type MissionPick } from "./catalog";
import { getMissionBlocks } from "./mission-blocks";

/** Credit requires the verified block that crossed the mission threshold; finishedAt must match its completion time. */
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

  // Later work cannot claim a broad anchor already satisfied by another block.
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
