import { type StudyBlockStatus } from "@zoonk/db";

const EXTRA_BLOCK_MINUTES = 10;

export type ExtraTimeReason = "nothingToStudy" | "plusRequired" | "sessionNotFinished";

type ExtraLesson = { minutes: number; title: string };

export type ExtraTime = {
  /** In plan order; empty for practice-only additions or until their content is known. */
  lessons: ExtraLesson[];
  minutes: number;
} & ({ available: true; reason: null } | { available: false; reason: ExtraTimeReason });

function isFinished(status: StudyBlockStatus): boolean {
  return status === "completed" || status === "skipped";
}

/** Requires the planned day finished or stopped unless anytime is set. */
export function getExtraTime({
  anytime = false,
  blocks,
}: {
  /** Practice the learner asks for elsewhere (an area in Progress) doesn't wait for the session. */
  anytime?: boolean;
  blocks: readonly { status: StudyBlockStatus }[];
}): ExtraTime {
  const minutes = EXTRA_BLOCK_MINUTES;

  if (!anytime && !blocks.every((block) => isFinished(block.status))) {
    return { available: false, lessons: [], minutes, reason: "sessionNotFinished" };
  }

  return { available: true, lessons: [], minutes, reason: null };
}
