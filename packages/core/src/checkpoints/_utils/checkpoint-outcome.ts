import { type Attempt } from "@zoonk/db";
import { type BlockPayload, getBlockItemIds } from "../../sessions/block-payload";
import { type CheckpointKind } from "../../sessions/brain-power";
import { getDuelDecision } from "../checkpoint-contract";
import { getPassMark, hasPassedCheckpoint } from "../checkpoint-rules";

export type CheckpointOutcome = {
  correct: number;
  kind: CheckpointKind;
  passMark: number;
  passed: boolean;
  total: number;
};

type DuelAnswer = Pick<Attempt, "isCorrect" | "itemId">;

function getQuestionVerdicts(answers: readonly DuelAnswer[]): boolean[] {
  const latest = new Map(
    answers.flatMap((answer) =>
      answer.itemId ? [[answer.itemId, answer.isCorrect] as const] : [],
    ),
  );

  return [...latest.values()];
}

/** Shortened duels must stay winnable; only a pass mark based on the original questions shrinks. */
export function getAskablePassMark({
  payload,
  questions,
}: {
  payload: BlockPayload;
  questions: number;
}): number {
  const passMark = payload.checkpoint?.passMark ?? 0;
  const itemIds = getBlockItemIds(payload).length;
  const shortened = questions < itemIds && passMark === getPassMark(itemIds);

  return shortened ? getPassMark(questions) : passMark;
}

/** Requires answers oldest first; duplicate submissions count once and removed questions can shorten the pass mark. */
export function getCheckpointOutcome({
  answers,
  payload,
  questions = getBlockItemIds(payload).length,
}: {
  answers: readonly DuelAnswer[];
  payload: BlockPayload;
  /** The questions it can still ask (`countAskableQuestions`), the block's by default. */
  questions?: number;
}): CheckpointOutcome | null {
  if (!payload.checkpoint) {
    return null;
  }

  const verdicts = getQuestionVerdicts(answers);
  const correct = verdicts.filter(Boolean).length;
  const passMark = getAskablePassMark({ payload, questions });

  return {
    correct,
    kind: payload.checkpoint.kind,
    passMark,
    passed: hasPassedCheckpoint({ correct, passMark }),
    total: verdicts.length,
  };
}

export function isBlockDuelDecided({
  answers,
  payload,
  questions = getBlockItemIds(payload).length,
}: {
  /** The block's own answers, oldest first. */
  answers: readonly DuelAnswer[];
  payload: BlockPayload;
  /** The questions it can still ask (`countAskableQuestions`), the block's by default. */
  questions?: number;
}): boolean {
  if (!payload.checkpoint) {
    return false;
  }

  const verdicts = getQuestionVerdicts(answers);

  const decision = getDuelDecision({
    answered: verdicts.length,
    correct: verdicts.filter(Boolean).length,
    kind: payload.checkpoint.kind,
    passMark: getAskablePassMark({ payload, questions }),
    questions,
  });

  return decision !== null;
}
