import { type CefrLevel } from "@zoonk/utils/cefr";
import { type MockLeftOut } from "../exams/mocks/mock-view-contract";
import { type MockDayWrittenPart } from "../exams/mocks/written-parts";
import { type CheckpointKind } from "../sessions/brain-power";
import { type CheckpointPhase } from "./checkpoint-contract";
import { type CheckpointReward } from "./checkpoint-reward";

/** `tried` retries tomorrow; `queued` waits for an earlier phase. `waiting` preserves its pending item and saved day. */
export const CHALLENGE_STATUSES = [
  "done",
  "plusRequired",
  "queued",
  "ready",
  "started",
  "tried",
  "upcoming",
  "waiting",
] as const;

export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number];

export type ChallengeSection = {
  index: number;
  minutes: number;
  name: string | null;
  questions: number;
  tools: string | null;
};

export type ChallengeTopic = { name: string; subject: string | null };

/** Goal labels use targetLanguage; descriptions use the learner's language. Null goals/title mean the call is not written yet. */
export type ChallengeCall = {
  goals: { description: string; label: string }[] | null;
  level: CefrLevel;
  /** Minutes of talk, without the intro and the feedback around it. */
  minutes: number;
  targetLanguage: string;
  title: string | null;
};

export type ChallengeView = {
  /** Today's block for it, or the last one it was played in; null before its day. */
  blockId: string | null;
  call: ChallengeCall | null;
  canMove: boolean;
  /** Blocks starting a ready challenge; false while waitReason names an earlier prerequisite. */
  dailyLimitReached: boolean;
  /** The learner-local day it's planned for, YYYY-MM-DD. */
  date: string | null;
  /** Real learner pace, capped at minutes; defaults to exam pace and is null when size is unknown. */
  estimatedMinutes: number | null;
  examName: string | null;
  /** The challenge needs Plus to start; content and completed results remain visible. */
  locked: boolean;
  fullLength: boolean;
  goalId: string;
  kind: CheckpointKind;
  /** Mock clock limit or estimated checkpoint time; null while size is unknown. */
  minutes: number | null;
  mock: boolean;
  leftOut: MockLeftOut[];
  netScored: boolean;
  /** Next learner-local YYYY-MM-DD within a week; null for weekly challenges, exams, or no eligible day. */
  nextStudyDate: string | null;
  number: number | null;
  /** Questions needed to pass, or goals for a call; null while unknown. Weekly challenges reward finishing. */
  passMark: number | null;
  phase: CheckpointPhase | null;
  planItemId: string;
  /** The stored question count; null before it is known, 0 for a call or known empty challenge. */
  questions: number | null;
  /** Null before recording selection; zero for text questions or no known recording offer. */
  recordings: number | null;
  rematch: boolean;
  reinforcementLessons: number;
  /** Null before the first try and for weekly challenges. */
  result: { correct: number; passed: boolean; total: number } | null;
  reward: CheckpointReward;
  sections: ChallengeSection[];
  /** The share of a right answer each wrong one takes away; 0 where wrong answers cost nothing. */
  wrongPenalty: number;
  written: MockDayWrittenPart[];
  /** HH:MM in timeZone for an exam, otherwise the learner's study time; null means any time that day. */
  startTime: string | null;
  status: ChallengeStatus;
  timeZone: string | null;
  title: string;
  /** The learner's today, YYYY-MM-DD, so screens say "Today" or "Sunday" for `date`. */
  today: string;
  /** Plan-ordered topics; empty for mocks and language calls. */
  topics: ChallengeTopic[];
  /** Earlier lessons or challenges must finish or be skipped; null before session creation or when unblocked. */
  waitReason: "challenge" | "lessons" | null;
};

export type ChallengeDestination = {
  blockId: string;
  kind: "checkpoint" | "mock";
  sessionId: string;
};
