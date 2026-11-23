import { toBlockPayload } from "../block-payload";
import { type PlannedBlock, type PlannedCheckpoint } from "../session-builder";

export function buildCheckpointBlock(checkpoint: PlannedCheckpoint): PlannedBlock {
  const {
    afterLessons = false,
    itemIds,
    reinforcement: _reinforcement,
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
      afterLessons,
      checkpoint: details,
      itemIds,
      planItemId,
      planItemKey,
      skillIds,
      title,
    }),
  };
}

export function buildMockDay(checkpoints: readonly PlannedCheckpoint[]) {
  const mocks = checkpoints.filter((checkpoint) => checkpoint.mock);

  return {
    blocks: mocks.map((mock) => buildCheckpointBlock(mock)),
    plannedMinutes: Math.ceil(mocks.reduce((sum, mock) => sum + mock.minutes, 0)),
  };
}
