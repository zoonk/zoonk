import "server-only";
import { type LearnerBuddy, getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getReadAt } from "@/lib/learn/read-at";
import { toStudyDayDate } from "@/lib/learn/tab-missions";
import { type LearnerViewCopy } from "@/lib/learner/learner-view-copies";
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
import { type DayBlockRef, getDayBlockScreen, toDayBlockRef } from "@zoonk/core/sessions/day-block";
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

/**
 * Where a step of the day plays and the work it is (`ref`), worked out here with core's own rules
 * so the browser carries them with the step: a tap names the step it showed without the browser
 * building refs, and a step that plays on the session screen opens there at once.
 */
type TodayStep = { ref: DayBlockRef; screen: ReturnType<typeof getDayBlockScreen> };

/**
 * Everything Today draws for the learner, read in one go by the page and by the browser's reads
 * of the view (`GET /api/learner/views/today`), so a view read again draws the same screen.
 */
export type TodayScreenData = {
  brainPower: number | null;
  buddy: LearnerBuddy;
  /** A language goal's due practice, level and speaking tasks; null for other goals. */
  language: LanguageTodayView | null;
  mistakes: MistakeAvailability;
  /** An exam goal's mocks to take any time, when Today offers them; null otherwise. */
  mocks: MockOptionsView | null;
  /** The newest change to a source the goal is built on, and the upload research asks for. */
  notices: { change: string | null; upload: GoalUploadRequest | null };
  planEnd: string | null;
  /** One per block of the day, in the same order. */
  steps: TodayStep[];
  syllabus: TodaySyllabus | null;
  today: TodayView;
};

/** Today's states the page draws itself, and its own copy of the learner's day once there is one. */
export type TodayScreenResult =
  | Exclude<TodayViewResult, { status: "ready" }>
  | { copy: LearnerViewCopy<TodayScreenData>; status: "ready" };

/** The study day a Today read shows, as the learner summary names it: `goalId:YYYY-MM-DD`. */
function getTodayDayKey(today: TodayView): string {
  return `${today.session.goalId ?? today.goal.id}:${toStudyDayDate(today.session.localDate)}`;
}

/** A language goal's due practice; nothing for other goals. */
async function loadLanguageToday(goal: TodayView["goal"]) {
  if (goal.kind !== "language") {
    return null;
  }

  const result = await getLanguageTodayView({ goalId: goal.id });
  return result.status === "ready" ? result.today : null;
}

/**
 * The plan's end as the Plan shows it, read only when Today has a proposed plan change to
 * explain for a plan without a date: that's the one case its sentence names an end.
 */
async function loadPlanEnd(today: TodayView): Promise<string | null> {
  const proposed =
    today.insight?.planChange?.status === "proposed" || today.planChange?.status === "proposed";

  if (!proposed || today.goal.targetDate) {
    return null;
  }

  const result = await getPlanTabView({ goalId: today.goal.id });
  return result.status === "ready" ? result.view.plan.estimate.endDate : null;
}

/**
 * An exam goal's mocks to take any time, which Today offers under "Practice anytime" to every
 * learner: without Plus, the row is marked Plus and its chooser says what Plus unlocks. Nothing
 * while no mock can be built.
 */
async function loadTodayMocks(goal: TodayView["goal"]) {
  if (goal.kind !== "exam") {
    return null;
  }

  const result = await getMockOptions({ goalId: goal.id });
  const view = result.status === "ready" ? result.view : null;

  return view && (view.running || view.options.length > 0) ? view : null;
}

/**
 * The goal's subjects for Today's aside, read as the Plan reads them, so the aside's rows are the
 * Plan's own (the same names, bars and shares) under its "See your plan". Only what the rows draw
 * goes to the browser (`TodaySyllabus`), never every topic and chapter.
 */
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

/** Open entries in the goal's mistakes notebook, which Today offers under "Practice anytime". */
async function countOpenMistakes(goalId: string): Promise<MistakeAvailability> {
  const result = await listCurrentUserMistakes({ goalId, limit: 1, offset: 0, status: "open" });
  return result.status === "ready" ? result.availability : { ready: 0, tomorrow: 0 };
}

/** The notices Today can show that need main's actions, each only when there's something to say. */
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

/**
 * Where each block plays and the work it is: a lesson's readiness only counts when Today read it,
 * so a lesson it holds no state for goes through the learner's action first (`unknown`).
 */
function toTodayStep({
  block,
  lessonStatus,
}: {
  block: TodayView["session"]["blocks"][number];
  lessonStatus: TodayView["lessonStatus"];
}): TodayStep {
  const status = block.lessonId ? lessonStatus[block.lessonId] : undefined;
  const lessonReady = block.lessonId && !status ? null : status === "ready";

  return { ref: toDayBlockRef(block), screen: getDayBlockScreen(block, { lessonReady }) };
}

/**
 * Today for the learner holding the session: the page's states (no goal, paused, the plan being
 * built), or the day with everything Today shows beside it. It only reads: the day the learner
 * hasn't opened yet is shown as it will open, and opening it is the learner's own tap.
 */
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

  const steps = today.session.blocks.map((block) =>
    toTodayStep({ block, lessonStatus: today.lessonStatus }),
  );

  return {
    copy: {
      day: getTodayDayKey(today),
      readAt,
      revision: today.revision,
      userId: today.userId,
      view: {
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
    },
    status: "ready",
  };
}
