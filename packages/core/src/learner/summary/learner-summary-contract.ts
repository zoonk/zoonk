import { type BuddyGlasses, type BuddyKind, type GoalKind, type GoalStatus } from "@zoonk/db/enums";
import { type BeltColor } from "@zoonk/utils/belt-level";

/** Timestamps are epoch milliseconds; signedInAt distinguishes separate sessions for the same learner. */
export type LearnerIdentity = {
  expiresAt: number;
  isAnonymous: boolean;
  signedInAt: number;
  userId: string;
};

export type LearnerTier = "free" | "guest" | "plus";

export type LearnerSummaryGoal = {
  courseId: string | null;
  dailyMinutes: number;
  id: string;
  isActive: boolean;
  kind: GoalKind;
  status: GoalStatus;
  /** `YYYY-MM-DD`, or null for a goal without a date. */
  targetDate: string | null;
  targetLanguage: string | null;
  title: string;
};

type LearnerSummaryBuddy = {
  beltColor: BeltColor;
  /** Null before any learning; the buddy remains awake without a glow. */
  energy: number | null;
  glasses: BuddyGlasses;
  kind: BuddyKind;
  name: string | null;
  studiedToday: boolean;
};

/** Learner-local YYYY-MM-DD; may name yesterday while its session carries over midnight. */
export type LearnerSummaryDay = { goalId: string; localDate: string };

export type LearnerSummaryToday = {
  blocksLeft: number;
  next: { minutes: number; sessionId: string; title: string | null } | null;
};

/** Mistakes become practice-ready at the next learner-local midnight, covered by nextChangeAt. */
export type LearnerSummaryPlaces = {
  exam: boolean;
  mindMaps: boolean;
  readyMistakes: number;
  speaking: boolean;
};

type LearnerSummaryAnalytics = {
  disabled: boolean;
  goal: { kind: GoalKind; phase: number | null } | null;
  /** The subscription's plan name, or "free". */
  plan: string;
  username: string | null;
};

export type LearnerSummary = {
  account: { email: string; image: string | null; name: string };
  activeGoalId: string | null;
  analytics: LearnerSummaryAnalytics;
  buddy: LearnerSummaryBuddy;
  /** The study day `today` and `missions` describe; null without an active goal. */
  day: LearnerSummaryDay | null;
  goals: LearnerSummaryGoal[];
  identity: LearnerIdentity;
  /** The belt and level, or null before any learning. */
  level: { color: BeltColor; level: number } | null;
  /** Today's missions done and offered; null on a day without missions or before it's saved. */
  missions: { done: number; total: number } | null;
  /** Epoch milliseconds of the next time-driven change, including local/UTC midnight and session expiry. */
  nextChangeAt: number;
  places: LearnerSummaryPlaces;
  /** Epoch milliseconds; later values identify newer snapshots. */
  readAt: number;
  tier: LearnerTier;
  /** The active goal's saved time zone, or null when it has none yet. */
  timeZone: string | null;
  /** Null before session creation, without a goal, or while paused. */
  today: LearnerSummaryToday | null;
};
