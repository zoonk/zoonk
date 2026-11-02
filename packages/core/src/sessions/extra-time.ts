import { type StudyBlockStatus } from "@zoonk/db";
import { MIN_BLOCK_MINUTES } from "./block-minutes";

const EXTRA_BLOCK_MINUTES = 10;

export type ExtraTimeReason =
  | "dailyLimit"
  | "nothingToStudy"
  | "plusRequired"
  | "sessionNotFinished";

type ExtraLesson = { minutes: number; title: string };

export type ExtraTime = {
  /** In plan order; empty for practice-only additions or until their content is known. */
  lessons: ExtraLesson[];
  minutes: number;
} & ({ available: true; reason: null } | { available: false; reason: ExtraTimeReason });

function isFinished(status: StudyBlockStatus): boolean {
  return status === "completed" || status === "skipped";
}

/** Requires the planned day finished or stopped unless anytime is set; always respects the learner's daily limit. */
export function getExtraTime({
  anytime = false,
  blocks,
  remainingLimitMinutes,
}: {
  /** Practice the learner asks for elsewhere (an area in Progress) doesn't wait for the session. */
  anytime?: boolean;
  blocks: readonly { status: StudyBlockStatus }[];
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
