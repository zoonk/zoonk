import { type StudyFreshStart, type StudySessionBlock } from "@zoonk/db";
import { type BlockPayload, toBlockPayload } from "../../sessions/block-payload";

/**
 * Writing practice for exams with an essay (ENEM's redação, OAB's brief, a discursive answer): a
 * focused stretch of writing graded with the official rubric, a few times a week.
 */
const ESSAY_BLOCK_MINUTES = 20;

/** The essay a produce block asks for: its item and skill, and the title it shows. */
export type PlannedProduce = { itemId: string; skillId: string; title: string | null };

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
  const fits = room >= ESSAY_BLOCK_MINUTES + minBlockMinutes;

  if (!produce || examTrialEnded || freshStart === "welcomeBack" || !fits) {
    return null;
  }

  return {
    canDo: null,
    estimatedMinutes: ESSAY_BLOCK_MINUTES,
    kind: "produce",
    lessonId: null,
    payload: toBlockPayload({
      itemIds: [produce.itemId],
      skillIds: [produce.skillId],
      title: produce.title,
    }),
  };
}
