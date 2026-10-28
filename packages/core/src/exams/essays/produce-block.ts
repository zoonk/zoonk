import { type StudyFreshStart, type StudySessionBlock } from "@zoonk/db";
import { type BlockPayload, toBlockPayload } from "../../sessions/block-payload";

const ESSAY_BLOCK_MINUTES = 20;

const DISCURSIVE_ANSWER_MINUTES = 8;

export function getEssayMinutes({ classTest }: { classTest: boolean }): number {
  return classTest ? DISCURSIVE_ANSWER_MINUTES : ESSAY_BLOCK_MINUTES;
}

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

export function toProduceBlock({
  examTrialEnded,
  freshStart,
  minBlockMinutes,
  produce,
  room,
}: {
  examTrialEnded: boolean;
  freshStart: StudyFreshStart | null;
  minBlockMinutes: number;
  produce: PlannedProduce | null;
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
