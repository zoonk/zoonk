import { type BlockPayload } from "../../sessions/block-payload";
import { type CheckpointKind } from "../../sessions/brain-power";
import { getPassMark, hasPassedCheckpoint } from "../checkpoint-rules";

export type CheckpointOutcome = {
  correct: number;
  kind: CheckpointKind;
  passMark: number;
  passed: boolean;
  total: number;
};

/** How a checkpoint block went: seven of ten wins, whatever the number of questions. */
export function getCheckpointOutcome({
  answers,
  payload,
}: {
  answers: readonly { isCorrect: boolean }[];
  payload: BlockPayload;
}): CheckpointOutcome | null {
  if (!payload.checkpoint) {
    return null;
  }

  const correct = answers.filter((answer) => answer.isCorrect).length;
  const passMark = getPassMark(answers.length);

  return {
    correct,
    kind: payload.checkpoint.kind,
    passMark,
    passed: hasPassedCheckpoint({ correct, passMark }),
    total: answers.length,
  };
}
