import { type StudyBlockKind, type StudyBlockStatus } from "@zoonk/db";
import { MIN_BLOCK_MINUTES } from "./session-builder";

/** "Keep learning" after the day's session: about ten minutes at a time, never an endless feed. */
const EXTRA_BLOCK_MINUTES = 10;

/**
 * Two bonus practice blocks a day at most: pacing beats binging for memory. The plan's next
 * lessons aren't bonus: studied today, they're the plan done a day early, so they never count.
 */
const MAX_EXTRA_PRACTICE_PER_DAY = 2;

/**
 * Why more time isn't offered: the day's two bonus practice blocks are used (with no lesson of the
 * plan left to add), the daily time limit leaves too little, nothing is left to practice or learn,
 * the session isn't finished yet, or a free exam plan's first week is over (its practice and new
 * lessons come with Plus).
 */
export type ExtraTimeReason =
  | "dailyCap"
  | "dailyLimit"
  | "nothingToStudy"
  | "plusRequired"
  | "sessionNotFinished";

/** A lesson of the plan more time would add, as the day lists it before the learner taps. */
export type ExtraLesson = { minutes: number; title: string };

export type ExtraTime = {
  available: boolean;
  /**
   * The plan's next lessons the time adds, in order; empty when it goes to practice instead (every
   * lesson is done), and until it's known what the time would hold.
   */
  lessons: ExtraLesson[];
  /** Minutes the time would take, shorter when the learner's daily limit leaves less. */
  minutes: number;
  reason: ExtraTimeReason | null;
};

/** What of a day's block the extra time reads. */
export type ExtraTimeBlock = { extra: boolean; kind: StudyBlockKind; status: StudyBlockStatus };

function isFinished(status: StudyBlockStatus): boolean {
  return status === "completed" || status === "skipped";
}

/** Whether the day still has room for bonus practice (see `MAX_EXTRA_PRACTICE_PER_DAY`). */
export function hasExtraPracticeLeft(blocks: readonly ExtraTimeBlock[]): boolean {
  const practice = blocks.filter((block) => block.extra && block.kind !== "learn");
  return practice.length < MAX_EXTRA_PRACTICE_PER_DAY;
}

/**
 * Whether more time is offered: only after the day's blocks are done or stopped, and never past
 * the learner's daily limit. What it holds (the plan's next lessons, else capped practice) is
 * worked out when it's added (see `planExtraBlocks`).
 */
export function getExtraTime({
  anytime = false,
  blocks,
  remainingLimitMinutes,
}: {
  /** Practice the learner asks for elsewhere (an area in Progress) doesn't wait for the session. */
  anytime?: boolean;
  blocks: readonly ExtraTimeBlock[];
  /** Minutes left under the learner's daily limit, or null without one. */
  remainingLimitMinutes: number | null;
}): ExtraTime {
  const minutes = Math.min(EXTRA_BLOCK_MINUTES, remainingLimitMinutes ?? EXTRA_BLOCK_MINUTES);

  if (remainingLimitMinutes !== null && remainingLimitMinutes < MIN_BLOCK_MINUTES) {
    return { available: false, lessons: [], minutes: 0, reason: "dailyLimit" };
  }

  if (!anytime && !blocks.every((block) => isFinished(block.status))) {
    return { available: false, lessons: [], minutes, reason: "sessionNotFinished" };
  }

  return { available: true, lessons: [], minutes, reason: null };
}
