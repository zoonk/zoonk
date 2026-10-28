import { type StudySessionBlock } from "@zoonk/db";
import { type TrueFalseLabels } from "../library/exams/true-false-labels";
import { type BlockCheckpoint } from "../sessions/block-payload";
import { type StudyBlockQuestion } from "../sessions/study-block-question";
import { type CheckpointReward } from "./checkpoint-reward";
import { type ExamDayChecklistItem } from "./weekly-challenge-rules";

export type CheckpointQuestion = StudyBlockQuestion;

export type CheckpointPhase = { index: number; name: string };

export type DuelDecision = "lost" | "won";

/** Returns null while undecided, for weekly challenges, and for calls whose pass mark is zero. */
export function getDuelDecision({
  answered,
  correct,
  kind,
  passMark,
  questions,
}: Pick<BlockCheckpoint, "kind" | "passMark"> & {
  /** Questions answered, each once. */
  answered: number;
  correct: number;
  /** The duel's questions, asked or not. */
  questions: number;
}): DuelDecision | null {
  if (kind === "weekly" || passMark <= 0) {
    return null;
  }

  if (correct >= passMark) {
    return "won";
  }

  const missed = answered - correct;
  return missed > 0 && questions - missed < passMark ? "lost" : null;
}

export type CheckpointView = Pick<
  BlockCheckpoint,
  "kind" | "mock" | "rematch" | "timeLimitMinutes"
> & {
  /** Saved verdicts include answered questions whose content was removed from the bank. */
  answeredQuestions?: { isCorrect: boolean; itemId: string }[];
  blockId: string;
  /** This attempt ended neutrally because none of its remaining questions could be asked. */
  endedWithoutQuestions?: boolean;
  checklist: ExamDayChecklistItem[];
  nextPhase: CheckpointPhase | null;
  passMark: number;
  phase: CheckpointPhase | null;
  planItemId: string | null;
  questions: CheckpointQuestion[];
  reinforcementLessons: number;
  result: { correct: number; passed: boolean; total: number } | null;
  /** Failed phase retries: tomorrow if finished today, open when back in plan, passed after a later win; null otherwise. */
  retry: "open" | "passed" | "tomorrow" | null;
  reward: CheckpointReward;
  sessionId: string;
  status: StudySessionBlock["status"];
  title: string | null;
  trueFalseLabels: TrueFalseLabels;
};
