import "server-only";
import { type Goal, type GoalKind } from "@zoonk/db";
import { loadGoalDateKind } from "../../exams/_utils/goal-date-estimate";
import { type ExamChoiceView } from "../../exams/choices/exam-choice-contract";
import { loadExamChoiceViews, loadExamChoices } from "../../exams/choices/load-exam-choices";
import { type ExamMomentView } from "../../exams/view/exam-view-contract";
import { loadExamMoment } from "../../exams/view/load-exam-moment";
import { getCurrentSuggestedGoal } from "../../goals/suggestions/get-current-suggested-goal";
import { type SuggestedGoalView } from "../../goals/suggestions/suggested-goal-contract";
import { followOwnedGoalTimeZone } from "../../learner/follow-goal-time-zone";
import {
  type LessonGenerationState,
  getLessonGenerationStates,
} from "../../library/generation/lesson-generation-state";
import { type MemoryInsightView } from "../../memory/memory-contract";
import { type ShortPlanToday, loadShortPlanDay } from "../../plans/_utils/load-short-plan-day";
import {
  type TodayPlanChangeView,
  loadTodayPlanChange,
} from "../../plans/_utils/today-plan-change";
import { type MockFundingView } from "../../plans/mock-funding-contract";
import { daysBetween } from "../../plans/planner/plan-calendar";
import { type PlanStatus } from "../../preparation/plan-status";
import { type ReadStudyDay, readStudyDay } from "../../sessions/_utils/read-study-day";
import { getSelectedPlanNotice } from "../../sessions/_utils/selected-plan-notice";
import { type TodayStudySessionInput } from "../../sessions/contract";
import { type DayView } from "../../sessions/day-view";
import { loadNoticedPattern, selectDayPattern } from "../language/_utils/today-pattern";
import { type NoticedPattern } from "../language/language-view-contract";
import { getLessonShare } from "../syllabus/lesson-share";
import { type TodayAdmission, admitToday, stillAdmitted } from "./_utils/admit-today";
import { countLessonsLeftToday } from "./_utils/count-lessons-left-today";
import { loadAroundSession } from "./_utils/load-around-session";
import { loadDayMockFunding } from "./_utils/load-mock-funding";
import { hasStudiedOn } from "./_utils/studied-on-day";

type TodayGoal = {
  /** The date is the likely day of an exam edition whose notice isn't out yet. */
  dateEstimated: boolean;
  /**
   * Whole days until the goal's date, counted from the session's local day; null without a date
   * and once it passed.
   */
  daysLeft: number | null;
  id: string;
  kind: GoalKind;
  targetDate: Date | null;
  title: string;
};

/**
 * The learner's pace ("Keeping pace") and where the goal stands, in one measure per goal: an
 * exam's preparation, with what it gained this week; any other goal's lessons studied or skipped
 * as known, of its plan's (the Plan's subjects added up, so finishing every one reads 100%).
 */
type TodayProgress =
  | { measure: "preparation"; status: PlanStatus | null; value: number; weekGain: number }
  | {
      /** `today`: the plan's lessons today's session still holds (see `countLessonsLeftToday`). */
      lessons: { done: number; today: number; total: number };
      measure: "lessons";
      status: PlanStatus | null;
      value: number;
    };

/** The week's checkpoint under the week row: "Sunday: mock exam · 2h 30m, timed". */
type TodayWeeklyChallenge = {
  access: "open" | "plusRequired";
  date: Date | null;
  kind: "mixed" | "mock";
  /** An unsaved selected challenge stays visible without an intro action until Open persists it. */
  planItemId: string | null;
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
  /** Read before the view's data, so delayed delivery never claims a newer learner revision. */
  revision: string;
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
  /** Exact saved contribution explaining a lighter day, welcome backs included; null without one. */
  mockFunding: MockFundingView | null;
  /**
   * A language goal's pattern noticed in recent mistakes, offered beside the day; null when one of
   * the day's missions is already its drill (`selectDayPattern`), and for any other goal.
   */
  pattern: NoticedPattern | null;
  /**
   * The plan change to answer on Today: the newest proposal waiting for an OK, or an automatic
   * change of the last day (a rebalance, missed days, a test-out) until the learner says "Got it".
   */
  planChange: TodayPlanChangeView | null;
  progress: TodayProgress | null;
  session: DayView;
  /**
   * A test days away, planned day by day: "Day 1 of 3: map and gaps", and the day of its short
   * mock. Null for any other plan.
   */
  shortPlan: ShortPlanToday | null;
  /** A learner who studied today never sees a napping buddy. */
  studiedToday: boolean;
  /** A course the learner was taking before goals existed, offered as another goal to plan. */
  suggestedGoal: SuggestedGoalView | null;
  /** The authenticated viewer who produced this read, retained across delayed delivery. */
  userId: string;
  weeklyChallenge: TodayWeeklyChallenge | null;
};

export type TodayViewResult =
  | { revision: string; status: "goalNotActive"; userId: string }
  /** No goal yet: the apps open onboarding, or first offer the suggested goal when there's one. */
  | { revision: string; status: "noGoal"; suggestedGoal: SuggestedGoalView | null; userId: string }
  | { status: "notFound" }
  | {
      goal: Pick<TodayGoal, "id" | "kind" | "title">;
      revision: string;
      status: "preparing";
      userId: string;
    }
  | { status: "ready"; today: TodayView }
  | { status: "unauthorized" };

/**
 * Whole days until the goal's date: 0 on the day itself, and null without one or once it passed,
 * when there's nothing left to count down to (Lucas's Today said "The day is here" every day after
 * his).
 */
function getDaysLeft({ localDate, targetDate }: { localDate: Date; targetDate: Date | null }) {
  const days = targetDate ? daysBetween(localDate, targetDate) : -1;
  return days >= 0 ? days : null;
}

/** Where the goal stands, in its measure (see `TodayProgress`); null for a quick explanation. */
function toTodayProgress({
  lessons,
  lessonsToday,
  preparation,
}: Pick<Awaited<ReturnType<typeof loadAroundSession>>, "lessons" | "preparation"> & {
  lessonsToday: number;
}): TodayProgress | null {
  if (preparation.status !== "ready") {
    return null;
  }

  const { status, value, weekGain } = preparation.preparation;

  if (!lessons) {
    return { measure: "preparation", status, value, weekGain };
  }

  return {
    lessons: { ...lessons, today: lessonsToday },
    measure: "lessons",
    status,
    value: getLessonShare(lessons),
  };
}

/** The day's session for the screen, with what Today reads from the session's day. */
async function loadSessionDay({
  day,
  goal,
  userId,
}: {
  day: ReadStudyDay;
  goal: Goal;
  userId: string;
}) {
  const studySession = day.session;

  const lessonIds = studySession.blocks.flatMap((block) =>
    block.kind === "learn" && block.lessonId ? [block.lessonId] : [],
  );

  const shortPlan = await loadShortPlanDay({
    goal,
    source: day.selection
      ? {
          items: day.selection.items,
          phases: day.selection.phases,
          settings: day.selection.state.settings,
        }
      : undefined,
    today: studySession.localDate,
  });

  const [studied, lessonStates, exam] = await Promise.all([
    hasStudiedOn({ localDate: studySession.localDate, userId }),
    getLessonGenerationStates(lessonIds),
    loadExamMoment({
      goal,
      includesMockExams: studySession.examAccess.includesMockExams,
      shortPlan,
      today: studySession.localDate,
    }),
  ]);

  return { exam, lessonStates, shortPlan, studied, studySession };
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

/** The day Today shows for an admitted goal, with the read-only cards around it. */
async function readAdmittedToday({
  admission: { owned, stamp },
  timeZone,
}: {
  admission: Extract<TodayAdmission, { status: "admitted" }>;
  timeZone?: string;
}): Promise<TodayViewResult> {
  const { userId } = owned;
  const { id, kind, targetDate, title } = owned.goal;

  // Select the in-memory day once before projecting its surrounding read-only cards.
  const day = await readStudyDay({ goal: owned.goal, now: new Date(), timeZone, userId });

  if (!day) {
    return { ...stamp, goal: { id, kind, title }, status: "preparing" };
  }

  const mockFunding = await loadDayMockFunding({
    goal: owned.goal,
    localDate: day.session.localDate,
    selectedSettings: day.selection?.state.settings,
  });

  const [sessionDay, around, suggestedGoal, planChange, dateKind, examChoice, noticedPattern] =
    await Promise.all([
      loadSessionDay({ day, goal: owned.goal, userId }),
      loadAroundSession({ owned, selection: day.selection, session: day.session, timeZone }),
      getCurrentSuggestedGoal(),
      getSelectedPlanNotice({ now: new Date(), selection: day.selection }) ??
        loadTodayPlanChange({ goal: owned.goal, now: new Date(), timeZone }),
      loadGoalDateKind(owned.goal, day.blueprint),
      loadOpenExamChoice(owned.goal),
      loadNoticedPattern({ goal: owned.goal, userId }),
    ]);

  const { exam, lessonStates, shortPlan, studied, studySession } = sessionDay;

  const lessonsToday = around.lessons
    ? await countLessonsLeftToday({ selectedItems: day.selection?.items, session: studySession })
    : 0;

  return {
    status: "ready",
    today: {
      ...stamp,
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
      mockFunding,
      pattern: selectDayPattern({ day: studySession, pattern: noticedPattern }),
      planChange,
      progress: toTodayProgress({ ...around, lessonsToday }),
      session: studySession,
      shortPlan,
      studiedToday: studied || studySession.minutes.done > 0,
      suggestedGoal,
      weeklyChallenge: around.challenge,
    },
  };
}

/**
 * `readAdmittedToday` in its own private cache scope, for the API's follow, which can't run in one
 * (it writes): the day's readers tag what they read (`cacheTag`), which only works inside a scope.
 */
async function readAdmittedTodayInScope(
  input: Parameters<typeof readAdmittedToday>[0],
): Promise<TodayViewResult> {
  "use cache: private";

  return readAdmittedToday(input);
}

/**
 * A read-only day preview, or its saved authoritative session. Unstarted work carries logical
 * references until the learner opens it with a POST; prefetch never creates or settles a day.
 */
export async function getTodayView(input: TodayStudySessionInput): Promise<TodayViewResult> {
  "use cache: private";

  const admission = await admitToday(input.goalId);

  return admission.status === "admitted"
    ? readAdmittedToday({ admission, timeZone: input.timeZone })
    : admission;
}

/**
 * Today as an app on the learner's device reads it (the API's `GET /v1/today`): with `timeZone`,
 * the goal Today shows follows the device first (`followGoalTimeZone`: a goal without a zone
 * stores it, one whose learner moved takes it while nothing was done yet in its day), then its day
 * is read. The goal is resolved once, so the goal that moved is the goal returned, and admitted
 * again only after a follow that could have changed it. Only a goal Today shows a day for moves: a
 * goal it refuses (paused, a quick explanation's, one whose plan or guest onboarding isn't ready)
 * keeps its zone.
 */
export async function getTodayViewFollowingDevice(
  input: TodayStudySessionInput,
): Promise<TodayViewResult> {
  const { timeZone } = input;
  const admission = await admitToday(input.goalId);

  if (admission.status !== "admitted") {
    return admission;
  }

  // Already the goal's zone, or none sent: nothing moves, so the day is read from this admission.
  if (!timeZone || timeZone === admission.owned.goal.timezone) {
    return readAdmittedTodayInScope({ admission, timeZone });
  }

  // The move commits only while Today still shows the goal a day, as read under its locks.
  await followOwnedGoalTimeZone({
    admits: (tx) => stillAdmitted(tx, admission),
    owned: admission.owned,
    timeZone,
  });

  // The follow may have moved the goal, or met another writer who just did: Today admits it again.
  const admitted = await admitToday(admission.owned.goal.id);

  return admitted.status === "admitted"
    ? readAdmittedTodayInScope({ admission: admitted, timeZone })
    : admitted;
}
