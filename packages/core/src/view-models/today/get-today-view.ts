import "server-only";
import { type Goal, type GoalKind } from "@zoonk/db";
import { loadGoalDateKind } from "../../exams/_utils/goal-date-estimate";
import { type ExamChoiceView } from "../../exams/choices/exam-choice-contract";
import { readExamChoices } from "../../exams/choices/exam-choices";
import { loadExamChoiceViews } from "../../exams/choices/load-exam-choices";
import { type ExamMomentView } from "../../exams/view/exam-view-contract";
import { loadExamMoment } from "../../exams/view/load-exam-moment";
import { getCurrentSuggestedGoal } from "../../goals/suggestions/get-current-suggested-goal";
import { type SuggestedGoalView } from "../../goals/suggestions/suggested-goal-contract";
import { readSavedPlan } from "../../learner/facts/saved-plan";
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
import { getSelectedCatchUpItems } from "../../sessions/_utils/selected-day-plan";
import { type TodayStudySessionInput } from "../../sessions/contract";
import { withLessonScreens } from "../../sessions/day-block";
import { type DayView } from "../../sessions/day-view";
import { loadNoticedPattern, selectDayPattern } from "../language/_utils/today-pattern";
import { type NoticedPattern } from "../language/language-view-contract";
import { getLessonShare } from "../syllabus/lesson-share";
import { type TodayAdmission, admitToday } from "./_utils/admit-today";
import { countLessonsLeftToday } from "./_utils/count-lessons-left-today";
import { loadAroundSession } from "./_utils/load-around-session";
import { loadDayMockFunding } from "./_utils/load-mock-funding";
import { hasStudiedOn } from "./_utils/studied-on-day";

type TodayGoal = {
  /** The date is the likely day of an exam edition whose notice isn't out yet. */
  dateEstimated: boolean;
  /** From the session's learner-local day; null without a date or after it passed. */
  daysLeft: number | null;
  id: string;
  kind: GoalKind;
  targetDate: Date | null;
  title: string;
};

/** Exam goals use preparation; other planned goals use studied/known lesson share. */
type TodayProgress =
  | { measure: "preparation"; status: PlanStatus | null; value: number; weekGain: number }
  | {
      /** today counts unfinished plan items in the session, once each. */
      lessons: { done: number; today: number; total: number };
      measure: "lessons";
      status: PlanStatus | null;
      value: number;
    };

type TodayWeeklyChallenge = {
  access: "open" | "plusRequired";
  date: Date | null;
  kind: "mixed" | "mock";
  /** An unsaved selected challenge stays visible without an intro action until Open persists it. */
  planItemId: string | null;
  questions: number | null;
  timeLimitMinutes: number | null;
  title: string | null;
};

export type TodayView = {
  /** Earlier unfinished teaching, in saved order, without a promise that it fits one session. */
  earlierWork?: { id: string | null; title: string }[];
  exam: ExamMomentView | null;
  /** Unselected options are not studied until the learner chooses. */
  examChoice: ExamChoiceView | null;
  goal: TodayGoal;
  insight: MemoryInsightView | null;
  /** No entry until a block's lesson is selected. */
  lessonStatus: Record<string, LessonGenerationState["status"]>;
  /** Exact saved contribution explaining a lighter day, welcome backs included; null without one. */
  mockFunding: MockFundingView | null;
  /** Hidden when missions already provide the drill entry, unless their unfinished rows are hidden. */
  pattern: NoticedPattern | null;
  /** Only actionable changes; proposals wait while the expired-trial notice owns the suggestion slot. */
  planChange: TodayPlanChangeView | null;
  progress: TodayProgress | null;
  session: DayView;
  /** Class-test day sequence; null for other plans. */
  shortPlan: ShortPlanToday | null;
  /** A learner who studied today never sees a napping buddy. */
  studiedToday: boolean;
  suggestedGoal: SuggestedGoalView | null;
  /** The authenticated viewer who produced this read, retained across delayed delivery. */
  userId: string;
  weeklyChallenge: TodayWeeklyChallenge | null;
};

export type TodayViewResult =
  | { status: "goalNotActive"; userId: string }
  /** No goal yet: the apps open onboarding, or first offer the suggested goal when there's one. */
  | { status: "noGoal"; suggestedGoal: SuggestedGoalView | null; userId: string }
  | { status: "notFound" }
  | { goal: Pick<TodayGoal, "id" | "kind" | "title">; status: "preparing"; userId: string }
  | { status: "ready"; today: TodayView }
  | { status: "unauthorized" };

function getDaysLeft({ localDate, targetDate }: { localDate: Date; targetDate: Date | null }) {
  const days = targetDate ? daysBetween(localDate, targetDate) : -1;
  return days >= 0 ? days : null;
}

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

  return {
    exam,
    lessonStates,
    shortPlan,
    studied,
    studySession: withLessonScreens(studySession, lessonStates),
  };
}

async function loadOpenExamChoice(goal: Goal): Promise<ExamChoiceView | null> {
  if (goal.kind !== "exam" || !goal.examBlueprintId) {
    return null;
  }

  const saved = await readSavedPlan(goal.userId, goal.id);

  const choices = await loadExamChoiceViews({
    choices: readExamChoices(saved?.settings),
    examBlueprintId: goal.examBlueprintId,
  });

  return choices.find((choice) => !choice.subject) ?? null;
}

async function readAdmittedToday({
  admission: { owned },
  timeZone,
}: {
  admission: Extract<TodayAdmission, { status: "admitted" }>;
  timeZone?: string;
}): Promise<TodayViewResult> {
  const { userId } = owned;
  const { id, kind, targetDate, title } = owned.goal;

  const day = await readStudyDay({ goal: owned.goal, now: new Date(), timeZone, userId });

  if (!day) {
    return { goal: { id, kind, title }, status: "preparing", userId };
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
      loadTodayPlanChange({ goal: owned.goal, now: new Date(), timeZone }),
      loadGoalDateKind(owned.goal, day.blueprint),
      loadOpenExamChoice(owned.goal),
      loadNoticedPattern({ goal: owned.goal, userId }),
    ]);

  const { exam, lessonStates, shortPlan, studied, studySession } = sessionDay;
  const proposalsOpen = !studySession.examAccess.trialEnded;
  const insight = around.insight.status === "ready" ? around.insight.insight : null;

  const lessonsToday = around.lessons
    ? await countLessonsLeftToday({ selectedItems: day.selection?.items, session: studySession })
    : 0;

  const shownChange = !proposalsOpen && planChange?.status === "proposed" ? null : planChange;

  return {
    status: "ready",
    today: {
      earlierWork: day.selection
        ? getSelectedCatchUpItems(day.selection).map((item) => ({
            id: item.id,
            title: item.titleSnapshot,
          }))
        : [],
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
      insight: !proposalsOpen && insight?.planChange?.status === "proposed" ? null : insight,
      lessonStatus: Object.fromEntries(
        [...lessonStates].map(([lessonId, state]) => [lessonId, state.status]),
      ),
      mockFunding,
      pattern: selectDayPattern({ day: studySession, pattern: noticedPattern }),
      planChange: shownChange,
      progress: toTodayProgress({ ...around, lessonsToday }),
      session: studySession,
      shortPlan,
      studiedToday: studied || studySession.minutes.done > 0,
      suggestedGoal,
      userId,
      weeklyChallenge: around.challenge,
    },
  };
}

/** Read-only preview or saved session; logical references require Open's POST and prefetch never creates or settles a day. */
export async function getTodayView(input: TodayStudySessionInput): Promise<TodayViewResult> {
  "use cache: private";

  const admission = await admitToday(input.goalId);

  return admission.status === "admitted"
    ? readAdmittedToday({ admission, timeZone: input.timeZone })
    : admission;
}
