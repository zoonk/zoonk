import { type StudySessionBlock } from "@zoonk/db";
import { type EmptyDay } from "./_utils/session-view";
import { readBlockPayload } from "./block-payload";

export const EXTRA_BLOCK_MINUTES = 10;

export type ExtraTimeReason = "dayOver" | "nothingToStudy" | "sessionNotFinished";

type ExtraLesson = { minutes: number; title: string };

export type ExtraTime = {
  /**
   * In plan order; empty for practice-only additions, until their content is known, and where the
   * day doesn't list them ({@link listsUpNext}).
   */
  lessons: ExtraLesson[];
  minutes: number;
} & ({ available: true; reason: null } | { available: false; reason: ExtraTimeReason });

type ExtraTimeBlock = Pick<StudySessionBlock, "status"> &
  Partial<Pick<StudySessionBlock, "kind" | "payload">>;

export function isScheduledMock(
  block: Partial<Pick<StudySessionBlock, "kind" | "payload">>,
): boolean {
  return (
    block.kind === "checkpoint" &&
    block.payload !== undefined &&
    readBlockPayload({ payload: block.payload }).checkpoint?.mock === true
  );
}

function allowsExtraStudy(block: ExtraTimeBlock): boolean {
  return (
    block.status === "completed" ||
    block.status === "skipped" ||
    isScheduledMock(block) ||
    (block.kind === "review" &&
      block.payload !== undefined &&
      readBlockPayload({ payload: block.payload }).mockPreparationReview === true)
  );
}

export function getExtraTime({
  anytime = false,
  blocks,
  current,
}: {
  /** Practice the learner asks for elsewhere (an area in Progress) doesn't wait for the session. */
  anytime?: boolean;
  blocks: readonly ExtraTimeBlock[];
  current: boolean;
}): ExtraTime {
  const minutes = EXTRA_BLOCK_MINUTES;

  if (!current) {
    return { available: false, lessons: [], minutes, reason: "dayOver" };
  }

  if (!anytime && !blocks.every((block) => allowsExtraStudy(block))) {
    return { available: false, lessons: [], minutes, reason: "sessionNotFinished" };
  }

  return { available: true, lessons: [], minutes, reason: null };
}

export type UpNextDay = {
  emptyDay: EmptyDay | null;
  lessonsComing: boolean;
  lessonsToPrepare: boolean;
};

/**
 * The plan's next lessons are listed before the tap only once the day has nothing of its own still
 * to come: not while its own lessons are outlined or wait to be asked for, and not on a day with
 * nothing new, whose one offer is practice.
 */
export function listsUpNext({ emptyDay, lessonsComing, lessonsToPrepare }: UpNextDay): boolean {
  return emptyDay === null && !lessonsComing && !lessonsToPrepare;
}
