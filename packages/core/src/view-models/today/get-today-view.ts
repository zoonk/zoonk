import "server-only";
import { type GoalKind, prisma } from "@zoonk/db";
import { getAgeGroup } from "@zoonk/utils/age";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getWeeklyChallenge } from "../../checkpoints/get-weekly-challenge";
import { loadIsEstimatedGoalDate } from "../../exams/_utils/goal-date-estimate";
import { type ExamMomentView } from "../../exams/view/exam-view-contract";
import { loadExamMoment } from "../../exams/view/load-exam-moment";
import { findActiveGoalId } from "../../goals/_utils/goal-view";
import { hasStudyGoal } from "../../goals/_utils/study-goal";
import { getCurrentSuggestedGoal } from "../../goals/suggestions/get-current-suggested-goal";
import { type SuggestedGoalView } from "../../goals/suggestions/suggested-goal-contract";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import {
  type LessonGenerationState,
  getLessonGenerationStates,
} from "../../library/generation/lesson-generation-state";
import { getCurrentMemoryInsight } from "../../memory/insights/get-current-memory-insight";
import { type MemoryInsightView } from "../../memory/memory-contract";
import { type ShortPlanToday, loadShortPlanDay } from "../../plans/_utils/load-short-plan-day";
import {
  type TodayPlanChangeView,
  loadTodayPlanChange,
} from "../../plans/_utils/today-plan-change";
import { daysBetween } from "../../plans/planner/plan-calendar";
import { getGoalPreparation } from "../../preparation/get-goal-preparation";
import { type PlanStatus } from "../../preparation/plan-status";
import { type StudySessionView } from "../../sessions/_utils/session-view";
import { type TodayStudySessionInput } from "../../sessions/contract";
import { getTodayStudySession } from "../../sessions/get-today-study-session";
import { getSession } from "../../users/get-session";

type TodayGoal = {
  /** The date is the likely day of an exam edition whose notice isn't out yet. */
  dateEstimated: boolean;
  /** Whole days until the goal's date, counted from the session's local day; null without a date. */
  daysLeft: number | null;
  id: string;
  kind: GoalKind;
  targetDate: Date | null;
  title: string;
};

/** Where the plan stands ("On track"), with preparation and this week's gain for other screens. */
type TodayProgress = { status: PlanStatus | null; value: number; weekGain: number };

/** The week's checkpoint under the week row: "Sunday: mock exam · 2h 30m, timed". */
type TodayWeeklyChallenge = {
  access: "open" | "plusRequired";
  date: Date | null;
  kind: "mixed" | "mock";
  /** The plan item the challenge is, which opens its intro before and on its day. */
  planItemId: string;
  questions: number;
  timeLimitMinutes: number | null;
  title: string;
};

/**
 * Today, the screen learners open every day: the goal and its countdown, where the plan stands,
 * today's session (its blocks and missions), the week, the week's checkpoint, at most one insight
 * and the plan change to answer. The apps and the public API read this.
 */
export type TodayView = {
  /** An exam goal's final stretch, day before, exam day or "How did it go?"; null otherwise. */
  exam: ExamMomentView | null;
  goal: TodayGoal;
  /**
   * A learner under 18 who just turned a guest session into an account, with no guardian invited:
   * Today offers to invite one (see `needsGuardianInvite`). Onboarding offers it after the age
   * question, but not to a guest.
   */
  guardianInvite: boolean;
  insight: MemoryInsightView | null;
  /**
   * Where each lesson of the day's learn blocks stands, so a stop still being written says so
   * instead of opening to a wait. A block whose lesson isn't picked yet has no entry.
   */
  lessonStatus: Record<string, LessonGenerationState["status"]>;
  /**
   * The plan change to answer on Today: the newest proposal waiting for an OK, or an automatic
   * change of the last day (a rebalance, missed days, a test-out) until the learner says "Got it".
   */
  planChange: TodayPlanChangeView | null;
  progress: TodayProgress | null;
  session: StudySessionView;
  /**
   * A test days away, planned day by day: "Day 1 of 3: map and gaps", and the day of its short
   * mock. Null for any other plan.
   */
  shortPlan: ShortPlanToday | null;
  /** A learner who studied today never sees a napping buddy. */
  studiedToday: boolean;
  /** A course the learner was taking before goals existed, offered as another goal to plan. */
  suggestedGoal: SuggestedGoalView | null;
  weeklyChallenge: TodayWeeklyChallenge | null;
};

export type TodayViewResult =
  | { status: "goalNotActive" }
  /** No goal yet: the apps open onboarding, or first offer the suggested goal when there's one. */
  | { status: "noGoal"; suggestedGoal: SuggestedGoalView | null }
  | { status: "notFound" }
  | { goal: Pick<TodayGoal, "id" | "kind" | "title">; status: "preparing" }
  | { status: "ready"; today: TodayView }
  | { status: "unauthorized" };

function getDaysLeft({ localDate, targetDate }: { localDate: Date; targetDate: Date | null }) {
  return targetDate ? Math.max(0, daysBetween(localDate, targetDate)) : null;
}

/** Whether the learner studied today, on this goal or another. */
async function hasStudiedOn({ localDate, userId }: { localDate: Date; userId: string }) {
  const today = await prisma.dailyProgress.findUnique({
    select: { timeSpentSeconds: true },
    where: { userDate: { date: localDate, userId } },
  });

  return (today?.timeSpentSeconds ?? 0) > 0;
}

/** How long after signing up Today offers the guardian invite onboarding couldn't. */
const GUARDIAN_INVITE_DAYS = 1;

/**
 * A teen who just turned a guest session into an account (their goal is older than the account,
 * so onboarding ran while they were a guest and couldn't invite anyone) and has no guardian
 * invited: Today offers it for the first day, until they say "Not now". A learner who signed up
 * first was offered it right after the age question.
 */
async function needsGuardianInvite({
  goalCreatedAt,
  isAnonymous,
  now,
  userId,
}: {
  goalCreatedAt: Date;
  isAnonymous: boolean;
  now: Date;
  userId: string;
}): Promise<boolean> {
  if (isAnonymous) {
    return false;
  }

  const [user, profile, links] = await Promise.all([
    prisma.user.findUnique({ select: { createdAt: true }, where: { id: userId } }),
    prisma.userLearningProfile.findUnique({
      select: { birthMonth: true, birthYear: true, guardianInviteDismissedAt: true },
      where: { userId },
    }),
    prisma.guardianLink.count({ where: { status: { not: "revoked" }, userId } }),
  ]);

  const signedUpAt = user?.createdAt.getTime() ?? 0;
  const isFresh = now.getTime() - signedUpAt < GUARDIAN_INVITE_DAYS * MS_PER_DAY;
  const cameFromGuest = goalCreatedAt.getTime() < signedUpAt;

  const isTeen =
    getAgeGroup({
      birthMonth: profile?.birthMonth ?? null,
      birthYear: profile?.birthYear ?? null,
    }) === "teen";

  const dismissed = Boolean(profile?.guardianInviteDismissedAt);

  return isTeen && !dismissed && links === 0 && isFresh && cameFromGuest;
}

/** Everything around the session reads the goal the session belongs to. */
async function loadAroundSession({ goalId, timeZone }: { goalId: string; timeZone?: string }) {
  const [preparation, insight, challenge] = await Promise.all([
    getGoalPreparation(goalId),
    getCurrentMemoryInsight({ goalId }),
    getWeeklyChallenge({ goalId, timeZone }),
  ]);

  return { challenge, insight, preparation };
}

function toWeeklyChallenge(
  result: Awaited<ReturnType<typeof getWeeklyChallenge>>,
): TodayWeeklyChallenge | null {
  if (result.status !== "ready" || !result.challenge) {
    return null;
  }

  const { challenge } = result;

  return {
    access: challenge.access,
    date: challenge.date,
    kind: challenge.kind,
    planItemId: challenge.planItemId,
    questions: challenge.questions,
    timeLimitMinutes: challenge.conditions?.timeLimitMinutes ?? null,
    title: challenge.title,
  };
}

/**
 * A goal's plan is built in the background after onboarding. Until it has items there's no day to
 * build, and building one then would fix an empty day in place: the day is built once it's ready.
 */
async function isPlanBuilt(goalId: string): Promise<boolean> {
  const items = await prisma.planItem.count({ where: { plan: { goalId } } });
  return items > 0;
}

/**
 * Today's screen for a goal (the active goal by default). Opening it builds the day's session the
 * first time, like `getTodayStudySession`, so the screen and "Continue" always agree. A learner
 * without a goal, or with only quick explanations, gets `noGoal`, which the apps turn into "start a
 * goal"; a goal whose plan is still being built gets `preparing`, so the apps show the wait
 * instead of an empty day.
 *
 * One private cached read, so the tab bar's link prefetches Today whole and opening it is instant.
 * Building the day stays idempotent (one session per goal and day), so it's safe in a prefetch.
 * The browser keeps its copy for a while, so apps showing it from a prefetch read it again once
 * on screen when that copy is old (main's `useRefreshWhenOld`).
 */
export async function getTodayView(input: TodayStudySessionInput): Promise<TodayViewResult> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const goalId = input.goalId ?? (await findActiveGoalId(userId));

  if (!goalId) {
    return { status: "noGoal", suggestedGoal: await getCurrentSuggestedGoal() };
  }

  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  if (owned.goal.status !== "active") {
    return { status: "goalNotActive" };
  }

  // A quick explanation is a one-off: a learner with only explanations has no day to plan.
  if (owned.goal.kind === "explain" && !(await hasStudyGoal(userId))) {
    return { status: "noGoal", suggestedGoal: await getCurrentSuggestedGoal() };
  }

  const { id, kind, targetDate, title } = owned.goal;

  if (!(await isPlanBuilt(goalId))) {
    return { goal: { id, kind, title }, status: "preparing" };
  }

  const today = await getTodayStudySession({ ...input, goalId });

  if (today.status !== "ready") {
    return today;
  }

  const lessonIds = today.session.blocks.flatMap((block) =>
    block.kind === "learn" && block.lessonId ? [block.lessonId] : [],
  );

  const [
    around,
    studied,
    lessonStates,
    exam,
    suggestedGoal,
    shortPlan,
    planChange,
    estimated,
    guardianInvite,
  ] = await Promise.all([
    loadAroundSession({ goalId, timeZone: input.timeZone }),
    hasStudiedOn({ localDate: today.session.localDate, userId }),
    getLessonGenerationStates(lessonIds),
    loadExamMoment({
      goal: owned.goal,
      includesMockExams: today.session.examAccess.includesMockExams,
      today: today.session.localDate,
    }),
    getCurrentSuggestedGoal(),
    loadShortPlanDay({ goal: owned.goal, today: today.session.localDate }),
    loadTodayPlanChange({ goalId, now: new Date() }),
    loadIsEstimatedGoalDate(owned.goal),
    needsGuardianInvite({
      goalCreatedAt: owned.goal.createdAt,
      isAnonymous: session.user.isAnonymous ?? false,
      now: new Date(),
      userId,
    }),
  ]);

  const { preparation } = around;

  return {
    status: "ready",
    today: {
      exam,
      goal: {
        dateEstimated: estimated,
        daysLeft: getDaysLeft({ localDate: today.session.localDate, targetDate }),
        id,
        kind,
        targetDate,
        title,
      },
      guardianInvite,
      insight: around.insight.status === "ready" ? around.insight.insight : null,
      lessonStatus: Object.fromEntries(
        [...lessonStates].map(([lessonId, state]) => [lessonId, state.status]),
      ),
      planChange,
      progress:
        preparation.status === "ready"
          ? {
              status: preparation.preparation.status,
              value: preparation.preparation.value,
              weekGain: preparation.preparation.weekGain,
            }
          : null,
      session: today.session,
      shortPlan,
      studiedToday: studied || today.session.minutes.done > 0,
      suggestedGoal,
      weeklyChallenge: toWeeklyChallenge(around.challenge),
    },
  };
}
