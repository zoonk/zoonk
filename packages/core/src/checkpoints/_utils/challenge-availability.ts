import { type ChallengeCall, type ChallengeStatus } from "../challenge-contract";
import { type ChallengeBlock } from "./owned-challenge";

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
