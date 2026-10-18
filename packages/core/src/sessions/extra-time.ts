import { type StudyBlockStatus } from "@zoonk/db";
import { MIN_BLOCK_MINUTES } from "./session-builder";

/** "10 more minutes" after the day's session: a bonus block, never an endless feed. */
const EXTRA_BLOCK_MINUTES = 10;

/** Two bonus blocks a day at most: pacing beats binging for memory. */
const MAX_EXTRA_BLOCKS_PER_DAY = 2;

/**
 * Why "10 more minutes" isn't offered: the day's two bonus blocks are used, the daily time limit
 * leaves too little, nothing is left to practice or learn, the session isn't finished yet, or a
 * free exam plan's first week is over (its practice and new lessons come with Plus).
 */
export type ExtraTimeReason =
  | "dailyCap"
  | "dailyLimit"
  | "nothingToStudy"
  | "plusRequired"
  | "sessionNotFinished";

export type ExtraTime = {
  available: boolean;
  /** Minutes the bonus block would take, shorter when the learner's daily limit leaves less. */
  minutes: number;
  reason: ExtraTimeReason | null;
};

function isFinished(status: StudyBlockStatus): boolean {
  return status === "completed" || status === "skipped";
}

/**
 * Whether "10 more minutes" is offered: only after the day's blocks are done or stopped, up to the
 * daily cap of bonus blocks, and never past the learner's daily limit.
 */
export function getExtraTime({
  anytime = false,
  blocks,
  remainingLimitMinutes,
}: {
  /** Practice the learner asks for elsewhere (an area in Progress) doesn't wait for the session. */
  anytime?: boolean;
  blocks: readonly { extra: boolean; status: StudyBlockStatus }[];
  /** Minutes left under the learner's daily limit, or null without one. */
  remainingLimitMinutes: number | null;
}): ExtraTime {
  const minutes = Math.min(EXTRA_BLOCK_MINUTES, remainingLimitMinutes ?? EXTRA_BLOCK_MINUTES);

  if (remainingLimitMinutes !== null && remainingLimitMinutes < MIN_BLOCK_MINUTES) {
    return { available: false, minutes: 0, reason: "dailyLimit" };
  }

  if (!anytime && !blocks.every((block) => isFinished(block.status))) {
    return { available: false, minutes, reason: "sessionNotFinished" };
  }

  if (blocks.filter((block) => block.extra).length >= MAX_EXTRA_BLOCKS_PER_DAY) {
    return { available: false, minutes, reason: "dailyCap" };
  }

  return { available: true, minutes, reason: null };
}
