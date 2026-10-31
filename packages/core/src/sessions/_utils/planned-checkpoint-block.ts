import { toBlockPayload } from "../block-payload";
import { type PlannedBlock, type PlannedCheckpoint } from "../session-builder";

export function buildCheckpointBlock(checkpoint: PlannedCheckpoint): PlannedBlock {
  const {
    itemIds,
    minutes,
    planItemId,
    planItemKey = null,
    skillIds,
    title,
    ...details
  } = checkpoint;

  return {
    canDo: null,
    estimatedMinutes: Math.max(1, Math.round(minutes)),
    kind: "checkpoint",
    lessonId: null,
    payload: toBlockPayload({
      checkpoint: details,
      itemIds,
      planItemId,
      planItemKey,
      skillIds,
      title,
    }),
  };
}
