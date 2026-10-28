import "server-only";
import { type LearnerBuddy, getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getReadAt } from "@/lib/learn/read-at";
import { toStudyDayDate } from "@/lib/learn/tab-missions";
import { type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import { getMockOptions } from "@zoonk/core/exams/mocks/options";
import { listGoalChangeNotices } from "@zoonk/core/library/sources/notices";
import {
  type GoalUploadRequest,
  getGoalUploadRequest,
} from "@zoonk/core/library/sources/upload-request";
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
import { getSyllabusView } from "@zoonk/core/view-models/syllabus/get";
import {
  type TodayView,
  type TodayViewResult,
  getTodayView,
} from "@zoonk/core/view-models/today/get";
import { type TodaySyllabus } from "@zoonk/learn/today";

/** Worked out here with core's rules, so the browser carries them with the step instead of building refs. */
type TodayStep = { ref: DayBlockRef; screen: DayBlockScreen };

export type TodayScreenData = {
  brainPower: number | null;
  buddy: LearnerBuddy;
  language: LanguageTodayView | null;
  mistakes: MistakeAvailability;
  mocks: MockOptionsView | null;
  notices: { change: string | null; upload: GoalUploadRequest | null };
  planEnd: string | null;
  steps: TodayStep[];
  syllabus: TodaySyllabus | null;
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

/** Offered to every learner: without Plus the row is marked Plus and its chooser says what Plus unlocks. */
async function loadTodayMocks(goal: TodayView["goal"]) {
  if (goal.kind !== "exam") {
    return null;
  }

  const result = await getMockOptions({ goalId: goal.id });
  const view = result.status === "ready" ? result.view : null;

  return view && (view.running || view.options.length > 0) ? view : null;
}

/** Only what the rows draw goes to the browser, never every topic and chapter. */
async function loadSyllabus(goalId: string): Promise<TodaySyllabus | null> {
  const result = await getSyllabusView({ goalId });

  if (result.status !== "ready") {
    return null;
  }

  const { goal, kind, lessons, subjects } = result.syllabus;

  return {
    goal,
    kind,
    lessons,
    subjects: subjects.map((subject) => ({
      key: subject.key,
      lessonsDone: subject.lessonsDone,
      lessonsKnown: subject.lessonsKnown,
      lessonsTotal: subject.lessonsTotal,
      name: subject.name,
      notPlannedReason: subject.notPlannedReason,
      preparation: subject.preparation,
      shortName: subject.shortName,
    })),
  };
}

async function countOpenMistakes(goalId: string): Promise<MistakeAvailability> {
  const result = await listCurrentUserMistakes({ goalId, limit: 1, offset: 0, status: "open" });
  return result.status === "ready" ? result.availability : { ready: 0, tomorrow: 0 };
}

async function loadNotices(goalId: string): Promise<TodayScreenData["notices"]> {
  const [changes, upload] = await Promise.all([
    listGoalChangeNotices({ goalId }),
    getGoalUploadRequest({ goalId }),
  ]);

  return {
    change: changes.status === "ready" ? (changes.notices[0]?.message ?? null) : null,
    upload: upload.status === "ready" ? upload.request : null,
  };
}

/** Only reads: a day not opened yet is shown as it will open, and opening it is the learner's own tap. */
export async function loadTodayScreen(): Promise<TodayScreenResult> {
  const result = await getTodayView({});

  if (result.status !== "ready") {
    return result;
  }

  const { today } = result;

  const [buddy, notices, planEnd, readAt, mocks, mistakes, language, syllabus, belt] =
    await Promise.all([
      getLearnerBuddy(),
      loadNotices(today.goal.id),
      loadPlanEnd(today),
      getReadAt(),
      loadTodayMocks(today.goal),
      countOpenMistakes(today.goal.id),
      loadLanguageToday(today.goal),
      loadSyllabus(today.goal.id),
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
      language,
      mistakes,
      mocks,
      notices,
      planEnd,
      steps,
      syllabus,
      today,
    },
    day: getTodayDayKey(today),
    readAt,
    status: "ready",
    userId: today.userId,
  };
}
