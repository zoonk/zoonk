import { type BuddyGlasses, type BuddyKind, type GoalKind, type GoalStatus } from "@zoonk/db/enums";
import { type BeltColor } from "@zoonk/utils/belt-level";

/**
 * Whose summary it is. `signedInAt` (when the session started, in milliseconds) tells two sign-ins
 * of the same learner apart, so a browser that held one never merges the other's data into it;
 * `expiresAt` is when the session ends.
 */
export type LearnerIdentity = {
  expiresAt: number;
  isAnonymous: boolean;
  signedInAt: number;
  userId: string;
};

/** Plus unlocks the paid features; a guest has no account to subscribe with yet. */
export type LearnerTier = "free" | "guest" | "plus";

/** One of the learner's goals as the goal switcher and the command palette list it. */
export type LearnerSummaryGoal = {
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

/** The buddy as every tab draws it: kind, name and glasses from the profile, growth and glow from progress. */
type LearnerSummaryBuddy = {
  beltColor: BeltColor;
  /** Null until a day of study has passed: a new buddy is awake, without a glow. */
  energy: number | null;
  glasses: BuddyGlasses;
  kind: BuddyKind;
  name: string | null;
  studiedToday: boolean;
};

/** Today's saved session: the blocks left and the one up next, which "Continue" opens. */
export type LearnerSummaryToday = {
  blocksLeft: number;
  next: { minutes: number; sessionId: string; title: string | null } | null;
};

/**
 * The active goal's own places beside the tabs: an exam's page, a language goal's speaking paper,
 * the mind maps once a chapter can have one, and how many of its notebook's mistakes are ready to
 * practice (they become ready at the learner's next local midnight, which `nextChangeAt` covers).
 */
export type LearnerSummaryPlaces = {
  exam: boolean;
  mindMaps: boolean;
  readyMistakes: number;
  speaking: boolean;
};

/** What analytics attach to the learner's events; analytics stay off while `disabled`. */
type LearnerSummaryAnalytics = {
  disabled: boolean;
  goal: { kind: GoalKind; phase: number | null } | null;
  /** The subscription's plan name, or "free". */
  plan: string;
  username: string | null;
};

/**
 * Everything the app's frame, the command palette and analytics show about the signed-in learner
 * or guest, in one bounded read. It never builds or settles a day: today's parts come from the day
 * already saved.
 */
export type LearnerSummary = {
  account: { email: string; image: string | null; name: string };
  activeGoalId: string | null;
  analytics: LearnerSummaryAnalytics;
  buddy: LearnerSummaryBuddy;
  goals: LearnerSummaryGoal[];
  identity: LearnerIdentity;
  /** The belt and level, or null before any learning. */
  level: { color: BeltColor; level: number } | null;
  /** Today's missions done and offered; null on a day without missions or before it's saved. */
  missions: { done: number; total: number } | null;
  /**
   * When the summary changes without a write (milliseconds): the learner's next midnight, the end
   * of a day carried over from the night before, the subscription's next change, or the session's
   * end, whichever comes first.
   */
  nextChangeAt: number;
  places: LearnerSummaryPlaces;
  /** When the server read it (milliseconds), ordering snapshots of the same revision. */
  readAt: number;
  /**
   * The learner's change counter (a decimal string): every write they can see raises it, so a
   * snapshot with a higher one is newer.
   */
  revision: string;
  tier: LearnerTier;
  /** The active goal's saved time zone, or null when it has none yet. */
  timeZone: string | null;
  /** Today's saved session; null before the day is saved, without a goal, or for a paused one. */
  today: LearnerSummaryToday | null;
};
