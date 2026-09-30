import {
  type BuddyGlasses,
  type BuddyKind,
  type ContentFeedbackReason,
  type ExperienceMode,
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
  type StudyBlockKind,
  type StudyBlockStatus,
  type StudySessionStatus,
  type VoteValue,
} from "../../../../generated/prisma/client";
import { type SeedLanguage } from "../_utils/localize";
import { type SeedCourse } from "../library/types";
import { type MemoryPreset } from "./memory-presets";

/** A day relative to today in the learner's time zone: 0 is today, -1 yesterday, 3 in three days. */
type Day = number;

/** Exam plans with a date use time-boxed phases; every other plan follows its skill graph. */
type SeedPhaseKind = "finalStretch" | "foundations" | "gaps" | "learn" | "practice";

/**
 * A plan phase. Exam phases are time windows and have no name: apps name them by kind. Other
 * phases take their dates and size from the plan's schedule (see `plan-schedule.ts`).
 */
type SeedPhase = {
  kind?: SeedPhaseKind;
  name: string;
  /** Exam phases only: the first and last day of the window. */
  startDay?: Day;
  endDay?: Day;
  milestone?: string;
};

/**
 * One step of a plan: a lesson or chapter of the goal's course by key, or a checkpoint, mock,
 * review or boss with its own title. Outside exams, items still to do after this week have no
 * day: they only set the skills' order, and the seed plans the rest like the app does.
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
type SeedPlanChange = {
  kind: "edited" | "estimateUpdated" | "missedDays" | "resumed" | "testedOut";
  status?: "applied" | "proposed";
  reason: string;
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
    changes?: SeedPlanChange[];
    /** Areas the learner asked to focus on, as plan settings keep them. */
    focusAreas?: string[];
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

/** A capsule: the ideas of one lesson (or one skill) sealed for review, with its quick questions. */
type SeedCapsule = {
  title: string;
  lesson?: string;
  skills: string[];
  items: string[];
  format?: "matchPairs" | "rapidFire" | "swipe";
};

/**
 * One stop of today's session, in the shape the session builder writes: capsules for a review,
 * a lesson for a learn block, drills on saved mistakes (by the key of the attempt that left them)
 * and questions for practice. Items and skills are keys; the payload stores ids.
 */
export type SeedBlock = {
  kind: StudyBlockKind;
  status: StudyBlockStatus;
  minutes: number;
  /** Brain Power a finished block paid. */
  brainPower?: number;
  lesson?: string;
  title?: string;
  capsules?: SeedCapsule[];
  drills?: { mistake: string; items: string[] }[];
  items?: string[];
  skills?: string[];
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
  mode: ExperienceMode;
  buddy?: { kind: BuddyKind; name: string; glasses: BuddyGlasses };
  birth?: { month: number; yearsOld: number };
  guardian?: { email: string; dailyLimitMinutes: number };
  goal: SeedGoal;
  skills: { skill: string; memory: MemoryPreset }[];
  attempts: SeedAttempt[];
  session: { status: StudySessionStatus; blocks: SeedBlock[] };
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
