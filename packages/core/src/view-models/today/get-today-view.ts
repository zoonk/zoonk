import "server-only";
import { type GoalKind, prisma } from "@zoonk/db";
import { getWeeklyChallenge } from "../../checkpoints/get-weekly-challenge";
import { type ExamMomentView } from "../../exams/view/exam-view-contract";
import { loadExamMoment } from "../../exams/view/load-exam-moment";
import { findActiveGoalId } from "../../goals/_utils/goal-view";
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
import { daysBetween } from "../../plans/planner/plan-calendar";
import { getGoalPreparation } from "../../preparation/get-goal-preparation";
import { type PlanStatus } from "../../preparation/plan-status";
import { type StudySessionView } from "../../sessions/_utils/session-view";
import { type TodayStudySessionInput } from "../../sessions/contract";
import { getTodayStudySession } from "../../sessions/get-today-study-session";
import { getSession } from "../../users/get-session";

type TodayGoal = {
  /** Whole days until the goal's date, counted from the session's local day; null without a date. */
  daysLeft: number | null;
  id: string;
  kind: GoalKind;
  targetDate: Date | null;
  title: string;
};

/** "On track · preparation 58% · +3 this week": the status line both modes show. */
type TodayProgress = { status: PlanStatus | null; value: number; weekGain: number };

/** The week's checkpoint under the week row: "Sunday: mock exam · 2h 30m, timed". */
type TodayWeeklyChallenge = {
  access: "open" | "plusRequired";
  date: Date | null;
  kind: "mixed" | "mock";
  questions: number;
  timeLimitMinutes: number | null;
  title: string;
};

/**
 * Fun reveals itself over days, so a new learner sees three things instead of twelve: the flight
 * plan and the buddy from the first day, the missions from the second study day. Focus reads the
 * same flags and has nothing to hide.
 */
type TodayReveal = { missions: boolean };

/**
 * Today, the screen learners open every day: the goal and its countdown, one status line, today's
 * session (the Focus card or the Fun flight plan and missions, from the same blocks), the week,
 * the week's checkpoint and at most one insight. Both modes and the public API read this.
 */
export type TodayView = {
  /** An exam goal's final stretch, day before, exam day or "How did it go?"; null otherwise. */
  exam: ExamMomentView | null;
  goal: TodayGoal;
  insight: MemoryInsightView | null;
  /**
   * Where each lesson of the day's learn blocks stands, so a stop still being written says so
   * instead of opening to a wait. A block whose lesson isn't picked yet has no entry.
   */
  lessonStatus: Record<string, LessonGenerationState["status"]>;
  progress: TodayProgress | null;
  reveal: TodayReveal;
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

async function loadStudyDays({ localDate, userId }: { localDate: Date; userId: string }) {
  const [earlier, today] = await Promise.all([
    prisma.dailyProgress.count({
      where: { date: { lt: localDate }, timeSpentSeconds: { gt: 0 }, userId },
    }),
    prisma.dailyProgress.findUnique({
      select: { timeSpentSeconds: true },
      where: { userDate: { date: localDate, userId } },
    }),
  ]);

  return { earlier, studiedToday: (today?.timeSpentSeconds ?? 0) > 0 };
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
 * without a goal gets `noGoal`, which the apps turn into "start a goal"; a goal whose plan is still
 * being built gets `preparing`, so the apps show the wait instead of an empty day.
 */
export async function getTodayView(input: TodayStudySessionInput): Promise<TodayViewResult> {
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

  const [around, studyDays, lessonStates, exam, suggestedGoal, shortPlan] = await Promise.all([
    loadAroundSession({ goalId, timeZone: input.timeZone }),
    loadStudyDays({ localDate: today.session.localDate, userId }),
    getLessonGenerationStates(lessonIds),
    loadExamMoment({ goal: owned.goal, today: today.session.localDate }),
    getCurrentSuggestedGoal(),
    loadShortPlanDay({ goal: owned.goal, today: today.session.localDate }),
  ]);

  const { preparation } = around;

  return {
    status: "ready",
    today: {
      exam,
      goal: {
        daysLeft: getDaysLeft({ localDate: today.session.localDate, targetDate }),
        id,
        kind,
        targetDate,
        title,
      },
      insight: around.insight.status === "ready" ? around.insight.insight : null,
      lessonStatus: Object.fromEntries(
        [...lessonStates].map(([lessonId, state]) => [lessonId, state.status]),
      ),
      progress:
        preparation.status === "ready"
          ? {
              status: preparation.preparation.status,
              value: preparation.preparation.value,
              weekGain: preparation.preparation.weekGain,
            }
          : null,
      reveal: { missions: studyDays.earlier > 0 },
      session: today.session,
      shortPlan,
      studiedToday: studyDays.studiedToday || today.session.minutes.done > 0,
      suggestedGoal,
      weeklyChallenge: toWeeklyChallenge(around.challenge),
    },
  };
}
