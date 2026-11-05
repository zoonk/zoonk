import "server-only";
import { type Goal, type StudySessionBlock } from "@zoonk/db";
import { findActiveSubscription } from "../../auth/subscription";
import { readBlockPayload } from "../../sessions/block-payload";

/**
 * Free language plans show the Plus call, but progress never depends on a locked challenge.
 * Writes keep the fresh check; GET reads pass `readActiveSubscription`.
 */
export async function arePhaseChallengesRequired({
  goalKind,
  readSubscription = findActiveSubscription,
  userId,
}: {
  goalKind: Goal["kind"];
  readSubscription?: typeof findActiveSubscription;
  userId: string;
}): Promise<boolean> {
  return goalKind !== "language" || Boolean(await readSubscription(userId));
}

type PhaseBlock = Pick<StudySessionBlock, "kind" | "payload" | "status">;

export function withoutLockedPhaseChallenges<Block extends PhaseBlock>({
  blocks,
  phaseChallengesRequired,
}: {
  blocks: readonly Block[];
  phaseChallengesRequired: boolean;
}): Block[] {
  if (phaseChallengesRequired) {
    return [...blocks];
  }

  return blocks.filter((block) => {
    const checkpoint = readBlockPayload(block).checkpoint;

    return (
      block.status === "completed" ||
      block.status === "skipped" ||
      block.kind !== "checkpoint" ||
      !checkpoint ||
      checkpoint.mock ||
      checkpoint.kind === "weekly"
    );
  });
}

export function shouldRefillAfterEntitlementLapse({
  blocks,
  phaseChallengesRequired,
}: {
  blocks: readonly PhaseBlock[];
  phaseChallengesRequired: boolean;
}): boolean {
  return withoutLockedPhaseChallenges({ blocks, phaseChallengesRequired }).length < blocks.length;
}
