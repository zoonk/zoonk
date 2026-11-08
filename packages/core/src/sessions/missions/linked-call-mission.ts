import { type StudySessionBlock, type TransactionClient } from "@zoonk/db";
import { type MissionPick } from "./catalog";
import { getMissionBlocks } from "./mission-blocks";

/** Credit requires the verified block that crossed the mission threshold; finishedAt must match its completion time. */
function isLinkedBlockMission({
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
function isLinkedCallMission({
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

type SourceLink = {
  call: { endedAt: Date | null; studyBlockId: string | null } | null;
  mockBlockId: string | null;
};

/** Read under the settlement's lock: the session block a call or mock actually finished. */
export async function findSourceLink(
  tx: TransactionClient,
  { source, userId }: { source: { id: string; kind: string } | undefined; userId: string },
): Promise<SourceLink> {
  const call =
    source?.kind === "conversation"
      ? await tx.languageConversation.findFirst({
          select: { endedAt: true, studyBlockId: true },
          where: { id: source.id, status: "completed", userId },
        })
      : null;

  const mock =
    source?.kind === "mockExam"
      ? await tx.mockExam.findFirst({ select: { blockId: true }, where: { id: source.id, userId } })
      : null;

  return { call, mockBlockId: mock?.blockId ?? null };
}

/** Only the session block a call or mock actually finished may credit that block's mission. */
export function isLinkedSourceMission({
  blocks,
  link,
  pick,
}: {
  blocks: readonly StudySessionBlock[];
  link: SourceLink;
  pick: MissionPick;
}): boolean {
  return (
    isLinkedCallMission({ blocks, call: link.call, pick }) ||
    (link.mockBlockId !== null && isLinkedBlockMission({ blockId: link.mockBlockId, blocks, pick }))
  );
}
