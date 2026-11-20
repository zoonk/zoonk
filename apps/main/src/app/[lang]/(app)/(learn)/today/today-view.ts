import "server-only";
import { hasCompletedLessons } from "@/lib/learn/has-completed-lessons";
import { type LearnerBuddy, getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getReadAt } from "@/lib/learn/read-at";
import { toStudyDayDate } from "@/lib/learn/tab-missions";
import { type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import { getMockOptions } from "@zoonk/core/exams/mocks/options";
import { type MistakeAvailability } from "@zoonk/core/mistakes/contract";
import { listCurrentUserMistakes } from "@zoonk/core/mistakes/list-current-user";
import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import {
  type DayBlockRef,
  type DayBlockScreen,
  toDayBlockRef,
} from "@zoonk/core/sessions/day-block";
import { type LanguageTodayView } from "@zoonk/core/view-models/language/contract";
import { getLanguageTodayView } from "@zoonk/core/view-models/language/today";
import { getPlanTabView } from "@zoonk/core/view-models/plan/get";
import {
  type TodayView,
  type TodayViewResult,
  getTodayView,
} from "@zoonk/core/view-models/today/get";

/** Worked out here with core's rules, so the browser carries them with the step instead of building refs. */
type TodayStep = { ref: DayBlockRef; screen: DayBlockScreen };

export type TodayScreenData = {
  brainPower: number | null;
  buddy: LearnerBuddy;
  completedLessons: boolean;
  language: LanguageTodayView | null;
  mistakes: MistakeAvailability;
  mocks: MockOptionsView | null;
  planEnd: string | null;
  steps: TodayStep[];
  today: TodayView;
};

export type TodayScreenResult =
  | Exclude<TodayViewResult, { status: "ready" }>
  | { data: TodayScreenData; day: string; readAt: number; status: "ready"; userId: string };

/** As the learner summary names it: `goalId:YYYY-MM-DD`. */
function getTodayDayKey(today: TodayView): string {
  return `${today.session.goalId ?? today.goal.id}:${toStudyDayDate(today.session.localDate)}`;
}

async function loadLanguageToday(goal: TodayView["goal"]) {
  if (goal.kind !== "language") {
    return null;
  }

  const result = await getLanguageTodayView({ goalId: goal.id });
  return result.status === "ready" ? result.today : null;
}

async function loadPlanEnd(today: TodayView): Promise<string | null> {
  const proposed =
    today.insight?.planChange?.status === "proposed" || today.planChange?.status === "proposed";

  if (!proposed || today.goal.targetDate) {
    return null;
  }

  const result = await getPlanTabView({ goalId: today.goal.id });
  return result.status === "ready" ? result.view.plan.estimate.endDate : null;
}

/** Offered to every learner: the chooser says what a subscription unlocks. */
async function loadTodayMocks(goal: TodayView["goal"]) {
  if (goal.kind !== "exam") {
    return null;
  }

  const result = await getMockOptions({ goalId: goal.id });
  const view = result.status === "ready" ? result.view : null;

  return view && (view.running || view.options.length > 0) ? view : null;
}

/** Lessons the plan skipped because the learner already knew them, for Today's progress cells. */
async function countOpenMistakes(goalId: string): Promise<MistakeAvailability> {
  const result = await listCurrentUserMistakes({ goalId, limit: 1, offset: 0, status: "open" });
  return result.status === "ready" ? result.availability : { ready: 0, tomorrow: 0 };
}

export async function loadTodayPractice(goalId: string) {
  const [completedLessons, mistakes] = await Promise.all([
    hasCompletedLessons(goalId),
    countOpenMistakes(goalId),
  ]);

  return { completedLessons, mistakes };
}

/** Only reads: a day not opened yet is shown as it will open, and opening it is the learner's own tap. */
export async function loadTodayScreen(): Promise<TodayScreenResult> {
  const result = await getTodayView({});

  if (result.status !== "ready") {
    return result;
  }

  const { today } = result;

  const [buddy, planEnd, readAt, mocks, practice, language, belt] = await Promise.all([
    getLearnerBuddy(),
    loadPlanEnd(today),
    getReadAt(),
    loadTodayMocks(today.goal),
    loadTodayPractice(today.goal.id),
    loadLanguageToday(today.goal),
    getBeltLevel(),
  ]);

  const steps = today.session.blocks.map((block) => ({
    ref: toDayBlockRef(block),
    screen: block.screen,
  }));

  return {
    data: {
      brainPower: belt?.totalBrainPower ?? 0,
      buddy,
      ...practice,
      language,
      mocks,
      planEnd,
      steps,
      today,
    },
    day: getTodayDayKey(today),
    readAt,
    status: "ready",
    userId: today.userId,
  };
}
