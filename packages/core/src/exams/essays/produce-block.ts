import { type StudySessionBlock } from "@zoonk/db";
import { type BlockPayload, toBlockPayload } from "../../sessions/block-payload";
import { type WritingPacing } from "./writing-contract";
import { type WritingRequest } from "./writing-supply";

export const WRITING_DRILL_MINUTES = 8;

export type PlannedProduce = {
  minutes: number;
  pacing?: WritingPacing["source"];
  placement?: boolean;
  skillId?: string;
  taskKey: string;
  title: string;
  unit: WritingRequest["unit"];
};

type ProduceBlock = Pick<StudySessionBlock, "canDo" | "kind" | "lessonId"> & {
  estimatedMinutes: number;
  payload: BlockPayload;
};

export function toProduceBlock(produce: PlannedProduce): ProduceBlock {
  return {
    canDo: null,
    estimatedMinutes: produce.minutes,
    kind: "produce",
    lessonId: null,
    payload: toBlockPayload({
      skillIds: produce.skillId ? [produce.skillId] : [],
      title: produce.title,
      writing: { admissionId: null, draft: null, taskKey: produce.taskKey, unit: produce.unit },
      writingPacing: produce.pacing ?? "practice",
      writingPlacement: produce.placement,
    }),
  };
}
