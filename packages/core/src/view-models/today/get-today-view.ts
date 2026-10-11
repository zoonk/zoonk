import "server-only";
import { type Goal, type GoalKind, prisma } from "@zoonk/db";
import { getWeeklyChallenge } from "../../checkpoints/get-weekly-challenge";
import { loadGoalDateKind } from "../../exams/_utils/goal-date-estimate";
import { type ExamChoiceView } from "../../exams/choices/exam-choice-contract";
import { loadExamChoiceViews, loadExamChoices } from "../../exams/choices/load-exam-choices";
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
import { loadStudySessionView } from "../../sessions/_utils/load-session-view";
import { type StudySessionView } from "../../sessions/_utils/session-view";
import { resolveTodaySession } from "../../sessions/_utils/today-session";
import { type TodayStudySessionInput } from "../../sessions/contract";
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

/** The learner's pace ("Keeping pace"), with preparation and this week's gain for other screens. */
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
  /**
   * One of the exam's choices the learner hasn't picked yet (ENEM's foreign language, after
   * "Decide later"), asked on Today until they do: the plan studies none of its options before.
   */
  examChoice: ExamChoiceView | null;
  goal: TodayGoal;
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

/** Everything around the session reads the goal the session belongs to. */
async function loadAroundSession({ goalId, timeZone }: { goalId: string; timeZone?: string }) {
  const [preparation, insight, challenge] = await Promise.all([
    getGoalPreparation(goalId),
    getCurrentMemoryInsight({ goalId }),
    getWeeklyChallenge({ goalId, timeZone }),
  ]);

  return { challenge, insight, preparation };
}

/** The day's session for the screen, with what Today reads from the session's day. */
async function loadSessionDay({
  day,
  goal,
  userId,
}: {
  day: Awaited<ReturnType<typeof resolveTodaySession>>;
  goal: Goal;
  userId: string;
}) {
  const studySession = await loadStudySessionView({ ...day, userId });

  const lessonIds = studySession.blocks.flatMap((block) =>
    block.kind === "learn" && block.lessonId ? [block.lessonId] : [],
  );

  const [studied, lessonStates, exam, shortPlan] = await Promise.all([
    hasStudiedOn({ localDate: studySession.localDate, userId }),
    getLessonGenerationStates(lessonIds),
    loadExamMoment({
      goal,
      includesMockExams: studySession.examAccess.includesMockExams,
      today: studySession.localDate,
    }),
    loadShortPlanDay({ goal, today: studySession.localDate }),
  ]);

  return { exam, lessonStates, shortPlan, studied, studySession };
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

/** The first of an exam goal's choices the learner hasn't picked, if any (see `TodayView`). */
async function loadOpenExamChoice(goal: Goal): Promise<ExamChoiceView | null> {
  if (goal.kind !== "exam" || !goal.examBlueprintId) {
    return null;
  }

  const choices = await loadExamChoiceViews({
    choices: await loadExamChoices(goal.id),
    examBlueprintId: goal.examBlueprintId,
  });

  return choices.find((choice) => !choice.subject) ?? null;
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
 * first time (`resolveTodaySession`), so the screen and "Continue" always agree. A learner
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

  // Whether the plan is built is read alongside the goal; it's only used once the goal is theirs.
  const [owned, built] = await Promise.all([findOwnedGoal(goalId), isPlanBuilt(goalId)]);

  if (owned.status !== "ready") {
    return owned;
  }

  // A paused, completed or archived goal has no day to plan: nothing is built for it.
  if (owned.goal.status !== "active") {
    return { status: "goalNotActive" };
  }

  // A quick explanation is a one-off: a learner with only explanations has no day to plan.
  if (owned.goal.kind === "explain" && !(await hasStudyGoal(userId))) {
    return { status: "noGoal", suggestedGoal: await getCurrentSuggestedGoal() };
  }

  const { id, kind, targetDate, title } = owned.goal;

  if (!built) {
    return { goal: { id, kind, title }, status: "preparing" };
  }

  // Building the day can move the plan first (see `ensureStudySession`), so the reads around the
  // session start once the day is resolved. None of them reads the session, so they load while
  // the session is read for the screen.
  const day = await resolveTodaySession({ goal: owned.goal, timeZone: input.timeZone, userId });

  const [sessionDay, around, suggestedGoal, planChange, dateKind, examChoice] = await Promise.all([
    loadSessionDay({ day, goal: owned.goal, userId }),
    loadAroundSession({ goalId, timeZone: input.timeZone }),
    getCurrentSuggestedGoal(),
    loadTodayPlanChange({ goal: owned.goal, now: new Date(), timeZone: input.timeZone }),
    loadGoalDateKind(owned.goal),
    loadOpenExamChoice(owned.goal),
  ]);

  const { exam, lessonStates, shortPlan, studied, studySession } = sessionDay;
  const { preparation } = around;

  return {
    status: "ready",
    today: {
      exam,
      examChoice,
      goal: {
        dateEstimated: dateKind.estimated,
        daysLeft: getDaysLeft({ localDate: studySession.localDate, targetDate }),
        id,
        kind,
        targetDate,
        title,
      },
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
      session: studySession,
      shortPlan,
      studiedToday: studied || studySession.minutes.done > 0,
      suggestedGoal,
      weeklyChallenge: toWeeklyChallenge(around.challenge),
    },
  };
}
