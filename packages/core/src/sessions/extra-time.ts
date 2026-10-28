import { type StudyBlockKind, type StudyBlockStatus } from "@zoonk/db";
import { MIN_BLOCK_MINUTES } from "./session-builder";

/** Bound extra study to short chunks rather than an endless feed. */
const EXTRA_BLOCK_MINUTES = 10;

/** Cap bonus practice for pacing; studying tomorrow's planned lessons early does not use this cap. */
const MAX_EXTRA_PRACTICE_PER_DAY = 2;

export type ExtraTimeReason =
  | "dailyCap"
  | "dailyLimit"
  | "nothingToStudy"
  | "plusRequired"
  | "sessionNotFinished";

type ExtraLesson = { minutes: number; title: string };

export type ExtraTime = {
  available: boolean;
  /** In plan order; empty for practice-only additions or until their content is known. */
  lessons: ExtraLesson[];
  minutes: number;
  reason: ExtraTimeReason | null;
};

export type ExtraTimeBlock = { extra: boolean; kind: StudyBlockKind; status: StudyBlockStatus };

function isFinished(status: StudyBlockStatus): boolean {
  return status === "completed" || status === "skipped";
}

export function hasExtraPracticeLeft(blocks: readonly ExtraTimeBlock[]): boolean {
  const practice = blocks.filter((block) => block.extra && block.kind !== "learn");
  return practice.length < MAX_EXTRA_PRACTICE_PER_DAY;
}

/** Requires the planned day finished or stopped unless anytime is set; always respects the learner's daily limit. */
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
