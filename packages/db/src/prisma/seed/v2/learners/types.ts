import {
  type BuddyGlasses,
  type BuddyKind,
  type ContentFeedbackReason,
  type FeedbackContentKind,
  type GoalKind,
  type GoalStatus,
  type LanguageSkill,
  type MemoryCategory,
  type MemoryOrigin,
  type MilestoneKind,
  type MistakeCause,
  type MistakeStatus,
  type PlanItemKind,
  type PlanItemStatus,
  type Prisma,
  type VoteValue,
} from "../../../../generated/prisma/client";
import { type Localized, type SeedLanguage } from "../_utils/localize";
import { type SeedCourse } from "../library/types";
import { type MemoryPreset } from "./memory-presets";

/** A day relative to today in the learner's time zone: 0 is today, -1 yesterday, 3 in three days. */
type Day = number;

/**
 * A phase of the skill graph. The planner dates it; an exam plan with a date has time windows
 * instead, which have no name: apps name them by kind.
 */
type SeedPhase = { name: string; milestone?: string };

/**
 * One skill of a goal's skill graph as the graph task writes it: an exam's skills with their area,
 * size in lessons, phase, weight and the notice's contents they teach.
 */
export type SeedGraphSkill = {
  skill: string;
  area: Localized;
  lessons: number;
  phase: number;
  weight: number | null;
  topics: readonly Localized[];
  /** A written test's skill, such as ENEM's essay (see `PlanGraphSkill.outcome`). */
  outcome?: boolean;
};

/**
 * One step of a plan: a lesson or chapter of the goal's course by key, or a checkpoint, mock,
 * review or boss with its own title. The seed writes what the learner finished and what's due this
 * week; the planner lays out the rest, so later items have no day: they only set the skills'
 * order.
 */
export type SeedPlanItem = {
  kind: PlanItemKind;
  phase: number;
  status: PlanItemStatus;
  lesson?: string;
  chapter?: string;
  title?: string;
  day?: Day;
};

/**
 * A change to the plan with its one-sentence reason: applied (with an undo) or proposed and waiting
 * for the learner's OK. A test-out change points at the plan items it skipped on its own.
 */
export type SeedPlanChange = {
  kind: "edited" | "estimateUpdated" | "missedDays" | "resumed" | "testedOut";
  status?: "applied" | "proposed";
  reason: string | Localized;
  payload: Prisma.InputJsonObject;
  day: Day;
};

export type SeedGoal = {
  key: string;
  kind: GoalKind;
  status?: GoalStatus;
  course: SeedCourse;
  /** The blueprint of the exam the goal prepares for, such as "enem". */
  exam?: string;
  prompt: string;
  title: string;
  details: Prisma.InputJsonObject;
  targetDate?: Date;
  dailyMinutes: number;
  studyTime: string;
  createdDay: Day;
  plan: {
    phases: SeedPhase[];
    items: SeedPlanItem[];
    /**
     * The skill graph's size, in lessons, of skills bigger than the Library's lessons for them, as
     * the graph task estimates it (at most 60 each). Other skills are the size of their lessons.
     */
    skillLessons?: Partial<Record<string, number>>;
    /**
     * The goal's whole skill graph, when it's more than its plan items teach (an exam's every
     * skill). Without it, the graph is the skills the plan items teach (see `buildPlanGraph`).
     */
    graph?: readonly SeedGraphSkill[];
    changes?: SeedPlanChange[];
    /** Areas the learner asked to focus on, as plan settings keep them. */
    focusAreas?: string[];
    /** The option the learner takes of each of the exam's choices, by the notice's names. */
    examChoices?: { group: Localized; subject: Localized }[];
  };
};

/** A question the learner answered: a bank item, or a lesson screen by lesson key and position. */
export type SeedAttempt = {
  key: string;
  item?: string;
  step?: { lesson: string; position: number };
  skill: string;
  answer: Prisma.InputJsonObject;
  isCorrect: boolean;
  day: Day;
  /** Answered during today's session. */
  inSession?: boolean;
  seconds: number;
  mistake?: {
    cause: MistakeCause | null;
    status: MistakeStatus;
    snapshot: Prisma.InputJsonObject;
    /** When a fixed mistake was answered right again; yesterday when absent. */
    fixedDay?: Day;
  };
};

/** How the learner studied over the past weeks, turned into ledger rows and daily totals. */
type SeedHistory = {
  days: number;
  /** Chance of skipping a day, so the calendar has real gaps. */
  skipChance: number;
  minutesPerDay: number;
  accuracy: number;
  energy: number;
  /** Days with a mock exam or a checkpoint, and how many of their questions were right. */
  mocks?: { day: Day; correct: number; total: number; title: string }[];
  checkpoints?: { day: Day; correct: number; total: number; title: string }[];
};

/** A unit's call at one level, as the scenario writer would store it. */
type SeedConversationScenario = { chapter: string; level: string; content: Prisma.InputJsonValue };

/**
 * What a language learner's history adds: levels per skill against the level test, words learned,
 * calls held (by unit, with the objectives met) and a pattern noticed in recent mistakes.
 */
export type SeedLanguageHistory = {
  levels: { skill: LanguageSkill; start: number; score: number }[];
  words: { text: string; day: Day }[];
  scenarios: SeedConversationScenario[];
  conversations: {
    chapter: string;
    day: Day;
    kind: "checkpoint" | "practice";
    level: string;
    minutes: number;
    objectivesMet: string[];
    spokenSeconds: number;
    feedback: Prisma.InputJsonValue;
  }[];
  pattern: { day: Day; title: string; content: Prisma.InputJsonValue; mistakes: string[] } | null;
};

export type SeedLearner = {
  key: string;
  email: string;
  name: string;
  username: string | null;
  isAnonymous?: boolean;
  plus?: boolean;
  language: SeedLanguage;
  timeZone: string;
  buddy?: { kind: BuddyKind; name: string; glasses: BuddyGlasses };
  /** The learner's own daily study limit, set in Appearance. */
  dailyLimitMinutes?: number;
  goal: SeedGoal;
  skills: { skill: string; memory: MemoryPreset }[];
  attempts: SeedAttempt[];
  /**
   * How far the learner got through today's session, which the seed builds as the app does when
   * the learner opens Today (core's session builder, from their plan as the day began): the first
   * `finished` blocks done and, when `started`, the next one begun. Null before the learner opens
   * Today, when the app builds it.
   */
  session: { finished: number; started?: boolean } | null;
  history: SeedHistory;
  brainPower: number;
  memory: { category: MemoryCategory; statement: string; origin: MemoryOrigin }[];
  /**
   * Belts, glasses and badges earned. A badge for a boss ("trapHunter") names the boss's plan item
   * by the day it was fought, and the key gets that item's id.
   */
  milestones: { kind: MilestoneKind; key: string; day: Day; shown: boolean; bossDay?: Day }[];
  /** Language goals only: levels, words, calls and a noticed pattern. */
  languageHistory?: SeedLanguageHistory;
  feedback: {
    kind: FeedbackContentKind;
    lesson?: string;
    item?: string;
    vote: VoteValue;
    reasons?: ContentFeedbackReason[];
    comment?: string;
  }[];
};
