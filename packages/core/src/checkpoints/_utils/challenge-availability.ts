import { type ChallengeCall, type ChallengeStatus } from "../challenge-contract";
import { type ChallengeBlock } from "./owned-challenge";

/**
 * An unavailable milestone is pending content, not an empty future or queued offer. One whose size
 * is unknown (null questions) isn't known to be empty, so it keeps its status.
 */
export function getAvailableChallengeStatus({
  block,
  call,
  isMock,
  size,
  status,
}: {
  block: ChallengeBlock | null;
  call: ChallengeCall | null;
  isMock: boolean;
  size: { questions: number | null };
  status: ChallengeStatus;
}): ChallengeStatus {
  const pending = status === "upcoming" || status === "queued";
  const empty = size.questions === 0;
  return pending && !isMock && !call && !block && empty ? "waiting" : status;
}
