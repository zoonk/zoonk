import { type BlockPayload } from "../../sessions/block-payload";

/** Deleted content clears an attempt's item relation; the block keeps which question it answered. */
export function restoreCheckpointAnswers<T extends { id: string; itemId: string | null }>({
  answers,
  payload,
}: {
  answers: readonly T[];
  payload: BlockPayload;
}): T[] {
  const saved = new Map(
    payload.checkpointAnswers.map(({ attemptId, itemId }) => [attemptId, itemId]),
  );

  return answers.map((answer) => ({
    ...answer,
    itemId: answer.itemId ?? saved.get(answer.id) ?? null,
  }));
}

/** Already asked questions still count, even after their content disappears from the bank. */
export function getCheckpointQuestionCount({
  answeredItemIds,
  askableItemIds,
}: {
  answeredItemIds: Iterable<string>;
  askableItemIds: Iterable<string>;
}): number {
  return new Set([...answeredItemIds, ...askableItemIds]).size;
}
