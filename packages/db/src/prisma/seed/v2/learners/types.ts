import {
  type BuddyGlasses,
  type BuddyKind,
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
} from "../../../../generated/prisma/client";
import { type Localized, type SeedLanguage } from "../_utils/localize";
import { type SeedCourse } from "../library/types";
import { type MemoryPreset } from "./memory-presets";

/** A day relative to today in the learner's time zone: 0 is today, -1 yesterday, 3 in three days. */
type Day = number;

/** An exam plan's time windows have no name: apps name them by kind. */
type SeedPhase = { name: string; milestone?: string };

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

/** Items after this week have no day: the planner lays them out, and they set the skills' order. */
export type SeedPlanItem = {
  kind: PlanItemKind;
  phase: number;
  status: PlanItemStatus;
  lesson?: string;
  chapter?: string;
  title?: string;
  day?: Day;
};

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
    /** Skills without an entry are the size of their Library lessons. */
    skillLessons?: Partial<Record<string, number>>;
    /** Without it, the graph is the skills the plan items teach. */
    graph?: readonly SeedGraphSkill[];
    changes?: SeedPlanChange[];
    focusAreas?: string[];
    examChoices?: { group: Localized; subject: Localized }[];
  };
};

export type SeedAttempt = {
  key: string;
  item?: string;
  step?: { lesson: string; position: number };
  skill: string;
  answer: Prisma.InputJsonObject;
  isCorrect: boolean;
  day: Day;
  inSession?: boolean;
  seconds: number;
  mistake?: {
    cause: MistakeCause | null;
    status: MistakeStatus;
    snapshot: Prisma.InputJsonObject;
    /** Yesterday when absent. */
    fixedDay?: Day;
  };
};

type SeedHistory = {
  days: number;
  skipChance: number;
  minutesPerDay: number;
  accuracy: number;
  energy: number;
  mocks?: { day: Day; correct: number; total: number; title: string }[];
  checkpoints?: { day: Day; correct: number; total: number; title: string }[];
};

type SeedConversationScenario = { chapter: string; level: string; content: Prisma.InputJsonValue };

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
  /** `key` when absent. A persona's copy keeps its persona's, so it studied on the same days. */
  historyKey?: string;
  email: string;
  name: string;
  username: string | null;
  isAnonymous?: boolean;
  plus?: boolean;
  language: SeedLanguage;
  timeZone: string;
  buddy?: { kind: BuddyKind; name: string; glasses: BuddyGlasses };
  dailyLimitMinutes?: number;
  goal: SeedGoal;
  skills: { skill: string; memory: MemoryPreset }[];
  attempts: SeedAttempt[];
  /**
   * The first `finished` blocks are done and, when `started`, the next one begun. Null before the
   * learner opens Today, when the app builds it.
   */
  session: { finished: number; started?: boolean } | null;
  history: SeedHistory;
  brainPower: number;
  memory: { category: MemoryCategory; statement: string; origin: MemoryOrigin }[];
  /** A boss badge names its boss's plan item by the day it was fought (`bossDay`). */
  milestones: { kind: MilestoneKind; key: string; day: Day; shown: boolean; bossDay?: Day }[];
  languageHistory?: SeedLanguageHistory;
};
