import { type StudyFreshStart, type StudySessionBlock } from "@zoonk/db";
import { type BlockPayload, toBlockPayload } from "../../sessions/block-payload";

/**
 * Writing practice for exams with an essay (ENEM's redação, OAB's brief): a focused stretch of
 * writing graded with the official rubric, a few times a week.
 */
const ESSAY_BLOCK_MINUTES = 20;

/**
 * A class test's discursive question ("uma dissertativa sobre osmose") asks a few lines: Pedro's
 * 20-minute essay took two thirds of his 30-minute day and left out the osmosis lesson before it.
 */
const DISCURSIVE_ANSWER_MINUTES = 8;

/** How long the essay takes to write: a class test's discursive answer is a few lines. */
export function getEssayMinutes({ classTest }: { classTest: boolean }): number {
  return classTest ? DISCURSIVE_ANSWER_MINUTES : ESSAY_BLOCK_MINUTES;
}

/**
 * The essay a produce block asks for: its item and skill, the title it shows and the minutes it
 * takes to write (`getEssayMinutes`).
 */
export type PlannedProduce = {
  itemId: string;
  minutes: number;
  skillId: string;
  title: string | null;
};

type ProduceBlock = Pick<StudySessionBlock, "canDo" | "kind" | "lessonId"> & {
  estimatedMinutes: number;
  payload: BlockPayload;
};

/**
 * The day's produce block when it fits: never on a free exam plan past its first week or on a
 * light welcome-back day, and only when the day has room for it after the fixed blocks.
 */
export function toProduceBlock({
  examTrialEnded,
  freshStart,
  minBlockMinutes,
  produce,
  room,
}: {
  examTrialEnded: boolean;
  freshStart: StudyFreshStart | null;
  /** The shortest block worth a stop: the essay leaves at least that for the rest of the day. */
  minBlockMinutes: number;
  produce: PlannedProduce | null;
  /** Minutes left after capsules and the checkpoint. */
  room: number;
}): ProduceBlock | null {
  const fits = produce !== null && room >= produce.minutes + minBlockMinutes;

  if (!produce || examTrialEnded || freshStart === "welcomeBack" || !fits) {
    return null;
  }

  return {
    canDo: null,
    estimatedMinutes: produce.minutes,
    kind: "produce",
    lessonId: null,
    payload: toBlockPayload({
      itemIds: [produce.itemId],
      skillIds: [produce.skillId],
      title: produce.title,
    }),
  };
}
