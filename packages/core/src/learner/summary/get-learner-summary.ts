import "server-only";
import { type Goal, type Subscription, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone, isValidTimeZone } from "@zoonk/utils/time-zone";
import { cacheLife, cacheTag } from "next/cache";
import { getActiveSubscription } from "../../auth/subscription";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getLearningProfileCacheTag,
  getUserProgressCacheTag,
  getUserSessionCacheTag,
  getUserSubscriptionCacheTag,
} from "../../cache/tags";
import {
  type PlanPhaseFacts,
  getCurrentPhaseFromFacts,
  loadPlanPhaseFacts,
} from "../../goals/_utils/plan-phase-facts";
import { hasSpeakingPaper } from "../../language/exam-speaking/_utils/exam-speaking-setup";
import { countReadyMistakesByDay } from "../../mistakes/mistake-availability";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { getSession } from "../../users/get-session";
import { getAnswerTimeZone } from "../_utils/owned-goal";
import { getRequestInstant } from "../facts/request-instant";
import { type LearnerFacts, loadLearnerFacts } from "./_utils/load-learner-facts";
import { loadActiveGoalDay } from "./_utils/summary-day";
import { getNextChangeAt, getSummaryProgress } from "./_utils/summary-progress";
import {
  type LearnerSummary,
  type LearnerSummaryGoal,
  type LearnerSummaryPlaces,
  type LearnerTier,
} from "./learner-summary-contract";

/**
 * The goal the tabs show (`findActiveGoalId`): the one the learner picked, or their first active
 * goal while none is picked yet.
 */
function findActiveGoal({
  activeGoalId,
  goals,
}: {
  activeGoalId: string | null | undefined;
  goals: readonly Goal[];
}): Goal | null {
  if (activeGoalId) {
    return goals.find((goal) => goal.id === activeGoalId) ?? null;
  }

  return goals.find((goal) => goal.status === "active") ?? null;
}

/** The goals the switcher and the palette list: not archived, the active one first, then oldest first. */
function toSummaryGoals({
  activeGoalId,
  goals,
}: {
  activeGoalId: string | null;
  goals: readonly Goal[];
}): LearnerSummaryGoal[] {
  return goals
    .filter((goal) => goal.status !== "archived")
    .toSorted((a, b) => Number(b.id === activeGoalId) - Number(a.id === activeGoalId))
    .map((goal) => ({
      dailyMinutes: goal.dailyMinutes,
      id: goal.id,
      isActive: goal.id === activeGoalId,
      kind: goal.kind,
      status: goal.status,
      targetDate: goal.targetDate ? toIsoDate(goal.targetDate) : null,
      targetLanguage: goal.targetLanguage,
      title: goal.title,
    }));
}

/**
 * Sessions in every zone's today and yesterday: the learner's day is in their goal's zone, which
 * this same read finds, so it asks for the days around the UTC date.
 */
function getRecentSessionRange(now: Date) {
  const utcToday = getDateInTimeZone({ date: now, timeZone: "UTC" }).getTime();
  return { gte: new Date(utcToday - 2 * MS_PER_DAY), lte: new Date(utcToday + MS_PER_DAY) };
}

/** The active goal's own zone, as the learner's device last set it; null before it has one. */
function getSavedTimeZone(goal: Goal | null): string | null {
  return goal?.timezone && isValidTimeZone(goal.timezone) ? goal.timezone : null;
}

function getTier({
  isAnonymous,
  subscription,
}: {
  isAnonymous: boolean;
  subscription: Subscription | null;
}): LearnerTier {
  if (isAnonymous) {
    return "guest";
  }

  return subscription ? "plus" : "free";
}

/**
 * The listed active goal's places: an exam's page, a language goal's speaking paper (from the
 * blueprint it names and the learner's speaking score) and its mind maps once a chapter has one.
 */
function getPlaces({
  activeGoal,
  facts,
  goal,
  readyMistakes,
}: {
  activeGoal: Goal | null;
  facts: LearnerFacts;
  goal: LearnerSummaryGoal | null;
  readyMistakes: number;
}): LearnerSummaryPlaces {
  if (!goal || !activeGoal) {
    return { exam: false, mindMaps: false, readyMistakes: 0, speaking: false };
  }

  const speakingScore = activeGoal.targetLanguage
    ? (facts.speakingScores[activeGoal.targetLanguage] ?? null)
    : null;

  return {
    exam: goal.kind === "exam",
    mindMaps: facts.mindMapGoalIds.includes(goal.id),
    readyMistakes,
    speaking: hasSpeakingPaper({
      blueprintName: facts.blueprintNames[activeGoal.id] ?? null,
      goal: activeGoal,
      speakingScore,
    }),
  };
}

/** The goal analytics tag events with: the listed active goal's kind and the phase it's in. */
function getAnalyticsGoal({
  goal,
  phaseChallengesRequired,
  phaseFacts,
}: {
  goal: LearnerSummaryGoal | null;
  phaseChallengesRequired: boolean;
  phaseFacts: readonly PlanPhaseFacts[];
}): LearnerSummary["analytics"]["goal"] {
  if (!goal) {
    return null;
  }

  const facts = phaseFacts.find((plan) => plan.goalId === goal.id);
  const phase = facts ? getCurrentPhaseFromFacts({ facts, phaseChallengesRequired }) : null;

  return { kind: goal.kind, phase };
}

/**
 * Everything the app's frame, the command palette and analytics show about the signed-in learner
 * or guest (see `LearnerSummary`): one bounded read of saved rows that never writes, never builds
 * or settles a day, and never runs the planner. Null without a session.
 *
 * The learner's revision is read first, with their own row, so everything read after it is at
 * least as new as the revision the summary carries.
 */
export async function getLearnerSummary(): Promise<LearnerSummary | null> {
  "use cache: private";

  // Request dedupe only: the browser's store decides when it's old (its revision, `nextChangeAt`),
  // so it never shortens how long the router keeps the pages that seed it.
  cacheLife({ stale: Infinity });

  const session = await getSession();

  if (!session) {
    return null;
  }

  const userId = session.user.id;
  const isAnonymous = Boolean(session.user.isAnonymous);

  cacheTag(
    getUserSessionCacheTag(userId),
    getGoalsCacheTag(userId),
    getLearningProfileCacheTag(userId),
    getUserSubscriptionCacheTag(userId),
    getUserProgressCacheTag(userId),
    getLearnerModelCacheTag(userId),
  );

  const user = await prisma.user.findUnique({
    select: {
      analyticsDisabled: true,
      image: true,
      learnerRevision: true,
      name: true,
      username: true,
    },
    where: { id: userId },
  });

  if (!user) {
    return null;
  }

  const now = await getRequestInstant();

  const [profile, goals, subscription, sessions, phaseFacts, facts] = await Promise.all([
    prisma.userLearningProfile.findUnique({ where: { userId } }),
    prisma.goal.findMany({ orderBy: { createdAt: "asc" }, where: { userId } }),
    isAnonymous ? null : getActiveSubscription(),
    prisma.studySession.findMany({
      include: { blocks: { orderBy: { position: "asc" } } },
      where: { localDate: getRecentSessionRange(now), userId },
    }),
    loadPlanPhaseFacts({ userId }),
    loadLearnerFacts(userId),
  ]);

  const activeGoal = findActiveGoal({ activeGoalId: profile?.activeGoalId, goals });
  const activeGoalId = activeGoal?.id ?? null;
  const timeZone = getAnswerTimeZone({ goal: activeGoal });
  const localDate = getDateInTimeZone({ date: now, timeZone });
  const listed = toSummaryGoals({ activeGoalId, goals });
  const current = listed.find((goal) => goal.isActive) ?? null;
  const phaseChallengesRequired = activeGoal?.kind !== "language" || subscription !== null;

  // One read of the goal's eligible mistakes: today's ready count, and a legacy day's own.
  const readyMistakesOn = activeGoal
    ? countReadyMistakesByDay({
        goal: activeGoal,
        goalId: activeGoal.id,
        timeZone,
        today: localDate,
        userId,
      })
    : undefined;

  const [goalDay, ready] = await Promise.all([
    loadActiveGoalDay({
      goal: activeGoal,
      localDate,
      now,
      phaseChallengesRequired,
      readyMistakesOn,
      sessions,
      timeZone,
    }),
    readyMistakesOn?.(localDate) ?? 0,
  ]);

  return {
    // The row, not the session: its cookie keeps a name or picture changed elsewhere for an hour.
    account: { email: session.user.email, image: user.image, name: user.name },
    activeGoalId,
    analytics: {
      disabled: user.analyticsDisabled,
      goal: getAnalyticsGoal({ goal: current, phaseChallengesRequired, phaseFacts }),
      plan: subscription?.plan ?? "free",
      username: user.username,
    },
    ...getSummaryProgress({ facts, localDate, profile, timeZone }),
    day: activeGoal ? { goalId: activeGoal.id, localDate: toIsoDate(goalDay.dayDate) } : null,
    goals: listed,
    identity: {
      expiresAt: session.session.expiresAt.getTime(),
      isAnonymous,
      signedInAt: session.session.createdAt.getTime(),
      userId,
    },
    missions: goalDay.missions,
    nextChangeAt: getNextChangeAt({
      carriedUntil: goalDay.carriedUntil,
      localDate,
      now,
      sessionExpiresAt: session.session.expiresAt,
      subscription,
      timeZone,
    }),
    places: getPlaces({ activeGoal, facts, goal: current, readyMistakes: ready }),
    readAt: now.getTime(),
    revision: String(user.learnerRevision),
    tier: getTier({ isAnonymous, subscription }),
    timeZone: getSavedTimeZone(activeGoal),
    today: goalDay.today,
  };
}
