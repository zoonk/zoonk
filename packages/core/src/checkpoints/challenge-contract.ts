import { type CefrLevel } from "@zoonk/utils/cefr";
import { type MockLeftOut } from "../exams/mocks/mock-view-contract";
import { type MockDayWrittenPart } from "../exams/mocks/written-parts";
import { type CheckpointKind } from "../sessions/brain-power";
import { type CheckpointPhase } from "./checkpoint-contract";
import { type CheckpointReward } from "./checkpoint-reward";

/**
 * Where a challenge stands for the learner today:
 * - `upcoming`: its saved day hasn't come.
 * - `ready`: it's today's, waiting to start.
 * - `started`: it's running; opening it continues where the learner left it.
 * - `tried`: a phase checkpoint finished today without passing; a new try comes tomorrow.
 * - `done`: it's behind the learner (passed, or the week's challenge finished).
 * - `plusRequired`: the learner's plan leaves it to Plus: a language call (including after Plus
 *   lapses), a mock without mocks in the plan, or a phase challenge after a free exam plan's first week.
 * - `waiting`: its playable content is unavailable, or it is due but today's session was planned
 *   without it. The pending item and its date remain in the plan.
 * - `queued`: a phase checkpoint whose lessons are done, after one still to win: a session duels
 *   one reached checkpoint, and this one once that one is won.
 */
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

/** A mock's section, as the intro lists it. */
export type ChallengeSection = {
  /** Its place in the exam's order. */
  index: number;
  minutes: number;
  name: string | null;
  questions: number;
  /** What may be used or is given in it, in the notice's words. */
  tools: string | null;
};

/** A topic a duel asks about, with its subject's short name where the goal has several. */
export type ChallengeTopic = { name: string; subject: string | null };

/**
 * A language goal's phase checkpoint: the unit's call, played on its own screen instead of a duel
 * of questions. Its talk time and level follow how the learner speaks now; its name and the goals
 * to get across (each in `targetLanguage`, with why or how in the learner's) are known once the
 * unit's call is written (ahead of its day), null before.
 */
export type ChallengeCall = {
  goals: { description: string; label: string }[] | null;
  level: CefrLevel;
  /** Minutes of talk, without the intro and the feedback around it. */
  minutes: number;
  targetLanguage: string;
  title: string | null;
};

/**
 * A plan's phase checkpoint (the Trickster) or the week's challenge (a mock exam for exam goals),
 * by its plan item, before its day and on it: when it is, what it asks, what it's worth and where
 * it stands. On its day, starting it opens its block of today's session.
 */
export type ChallengeView = {
  /** Today's block for it, or the last one it was played in; null before its day. */
  blockId: string | null;
  /** A language goal's phase checkpoint is the unit's call; null for every other challenge. */
  call: ChallengeCall | null;
  /** "Move to Monday": only the week's challenge, before it starts, from today or a later day. */
  canMove: boolean;
  /** The learner-local day it's planned for, YYYY-MM-DD. */
  date: string | null;
  /**
   * About how long it takes: for a mock, learners' real pace on the exam's mocks (never more than
   * `minutes`, its clock), the exam's own pace until that's known; `minutes` otherwise.
   */
  estimatedMinutes: number;
  examName: string | null;
  /** The challenge needs Plus to start; content and completed results remain visible. */
  locked: boolean;
  /** A mock the length of the real exam; a short one is half of it. False outside mocks. */
  fullLength: boolean;
  goalId: string;
  kind: CheckpointKind;
  /** Time on the clock for a mock; about how long a checkpoint takes otherwise. */
  minutes: number;
  mock: boolean;
  /** What a mock leaves out of the real exam, each with why; empty for any other challenge. */
  leftOut: MockLeftOut[];
  /** Wrong answers cost points, as in Cebraspe exams (see `wrongPenalty`). */
  netScored: boolean;
  /** "Mock exam 3": this goal's mocks, counting this one. */
  number: number | null;
  /**
   * Right answers that pass a phase checkpoint, or for a call the goals got across that win it
   * (null until its call is written); a weekly challenge pays for finishing.
   */
  passMark: number | null;
  phase: CheckpointPhase | null;
  planItemId: string;
  /** The questions it asks; 0 for a call, which asks none. */
  questions: number;
  /**
   * The recordings a listening phase's checkpoint asks its questions on, each played as in the
   * exam; 0 when it asks text questions (and before its day, while its questions aren't picked).
   */
  recordings: number;
  /** A phase checkpoint not passed on an earlier day, back again. */
  rematch: boolean;
  /** Available lessons selected for the last lost duel's misses by the rematch scheduler. */
  reinforcementLessons: number;
  /**
   * How a phase checkpoint's last finished try went, so one already won says so instead of
   * inviting a new duel; null before its first try and for the week's challenge.
   */
  result: { correct: number; passed: boolean; total: number } | null;
  reward: CheckpointReward;
  sections: ChallengeSection[];
  /** The share of a right answer each wrong one takes away; 0 where wrong answers cost nothing. */
  wrongPenalty: number;
  /**
   * A full-length mock's parts answered in writing (a discursive test, a legal brief), as the
   * notice states them: never objective questions. `asked`: the mock asks it with the exam's own
   * essay, graded after hand-in; otherwise the learner practices it in essay sessions. Empty for a
   * short mock.
   */
  written: MockDayWrittenPart[];
  /**
   * "HH:MM": when the real exam starts on the day a mock copies (in `timeZone`), else the time the
   * learner said they study (in their own zone, `timeZone` null). Null for any time that day.
   */
  startTime: string | null;
  status: ChallengeStatus;
  timeZone: string | null;
  title: string;
  /** The learner's today, YYYY-MM-DD, so screens say "Today" or "Sunday" for `date`. */
  today: string;
  /**
   * What its questions ask about, in plan order: once its block is built, the topics of the
   * questions it asks; before that, the topics a phase checkpoint's questions will come from, as
   * the plan sets them (the week's challenge has none before its block). Empty for a mock, which
   * lists its sections, and a language goal's call.
   */
  topics: ChallengeTopic[];
};

/** Where a started challenge is played: the checkpoint screen or the mock exam's. */
export type ChallengeDestination = {
  blockId: string;
  kind: "checkpoint" | "mock";
  sessionId: string;
};
