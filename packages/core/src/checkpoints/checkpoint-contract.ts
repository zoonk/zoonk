import { type StudySessionBlock } from "@zoonk/db";
import { type TrueFalseLabels } from "../library/exams/true-false-labels";
import { type BlockCheckpoint } from "../sessions/block-payload";
import { type StudyBlockResult } from "../sessions/get-study-block";
import { type CheckpointReward } from "./checkpoint-reward";
import { type ExamDayChecklistItem } from "./weekly-challenge-rules";

type BlockDetail = Extract<StudyBlockResult, { status: "ready" }>["detail"];

export type CheckpointQuestion = BlockDetail["questions"][number];

export type CheckpointPhase = { index: number; name: string };

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
  blockId: string;
  /** Rehearsing exam day before a mock: keys the apps translate and tick off on the device. */
  checklist: ExamDayChecklistItem[];
  nextPhase: CheckpointPhase | null;
  passMark: number;
  phase: CheckpointPhase | null;
  /** The plan item it plays, whose intro is the challenge page; null for an unplanned one. */
  planItemId: string | null;
  questions: CheckpointQuestion[];
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
