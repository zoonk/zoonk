import { type StudySessionBlock } from "@zoonk/db";
import { type TrueFalseLabels } from "../library/exams/true-false-labels";
import { type BlockCheckpoint } from "../sessions/block-payload";
import { type StudyBlockQuestion } from "../sessions/study-block-question";
import { type CheckpointReward } from "./checkpoint-reward";
import { type ExamDayChecklistItem } from "./weekly-challenge-rules";

export type CheckpointQuestion = StudyBlockQuestion;

export type CheckpointPhase = { index: number; name: string };

/** How a boss's duel was decided: his shield broke, or it can't break anymore. */
export type DuelDecision = "lost" | "won";

/**
 * A boss's duel is over as soon as it's decided, and the questions left are never asked: won once
 * its right answers reach the pass mark (the Trickster's shield is broken), lost once its misses
 * leave too few questions to reach it. Null while it can still go either way. A weekly challenge
 * pays for finishing, so it asks every question; a pass mark of 0 (a language boss's call) is
 * never decided this way.
 */
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

/**
 * The checkpoint screen: the phase checkpoint (the Trickster duel) or the weekly challenge (the Big
 * Challenge). It says upfront what the checkpoint asks
 * (questions without hints, the pass mark, a mock's time) and what it's worth, and once finished,
 * how it went. A lost boss comes back tomorrow after two short lessons; the next phase stays open.
 */
export type CheckpointView = Pick<
  BlockCheckpoint,
  "kind" | "mock" | "rematch" | "timeLimitMinutes"
> & {
  /** Saved verdicts include answered questions whose content was removed from the bank. */
  answeredQuestions?: { isCorrect: boolean; itemId: string }[];
  blockId: string;
  /** This attempt ended neutrally because none of its remaining questions could be asked. */
  endedWithoutQuestions?: boolean;
  /** Rehearsing exam day before a mock: keys the apps translate and tick off on the device. */
  checklist: ExamDayChecklistItem[];
  nextPhase: CheckpointPhase | null;
  passMark: number;
  phase: CheckpointPhase | null;
  /** The plan item it plays, whose intro is the challenge page; null for an unplanned one. */
  planItemId: string | null;
  questions: CheckpointQuestion[];
  /** Available lessons selected for this duel's misses by the rematch scheduler. */
  reinforcementLessons: number;
  /** Set once every question was answered and the checkpoint finished. */
  result: { correct: number; passed: boolean; total: number } | null;
  /**
   * A phase checkpoint that didn't pass, as things stand now: a new try `tomorrow` (it finished
   * today), `open` (it's back in the plan) or `passed` (a later try passed). Null otherwise.
   */
  retry: "open" | "passed" | "tomorrow" | null;
  reward: CheckpointReward;
  sessionId: string;
  status: StudySessionBlock["status"];
  title: string | null;
  /** The words the goal's true-or-false statements are answered with, by its exam. */
  trueFalseLabels: TrueFalseLabels;
};
