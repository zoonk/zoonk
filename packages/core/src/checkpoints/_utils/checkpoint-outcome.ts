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

/**
 * Each question's verdict once, by its latest answer (answers oldest first): two submissions of one
 * answer at once count as one, so they never break two pieces of the shield, win a lost duel or
 * lose one still open.
 */
function getQuestionVerdicts(answers: readonly DuelAnswer[]): boolean[] {
  const latest = new Map(
    answers.flatMap((answer) =>
      answer.itemId ? [[answer.itemId, answer.isCorrect] as const] : [],
    ),
  );

  return [...latest.values()];
}

/**
 * A checkpoint's pass mark on the questions it can still ask (`questions`, `countAskableQuestions`):
 * its own, or, once the bank removed some since it started (a picture that failed its checks),
 * seven of ten of the ones left. A shortened duel stays winnable on what's left, and every reader
 * that judges a duel by its answers (seven of ten answered: the challenge's last result,
 * milestones) agrees with it. Only a duel whose mark is its own questions' shortens: one still
 * waiting for its questions keeps its planned mark (`getPlannedQuestions`), and a call's 0 stays 0.
 */
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

/**
 * How a checkpoint block went: seven of ten wins, whatever the number of questions, each question
 * counted once. The pass mark is the duel's, asked or not: a boss's duel decided early, won or
 * lost, ends with questions left. A duel the bank shortened is judged on the questions it could
 * still ask (`getAskablePassMark`).
 */
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

/**
 * Whether a block's answers already decided its boss's duel, won or lost (`getDuelDecision`), each
 * question counted once. False for any block that isn't a checkpoint.
 */
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
