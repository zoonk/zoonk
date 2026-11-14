import "server-only";
import { loadSessionWeeklyChallenge } from "../../checkpoints/_utils/load-weekly-challenge";
import { isNetScored } from "../../checkpoints/weekly-challenge-rules";
import { loadSessionProduce } from "../../exams/essays/_utils/load-produce";
import { getDaysToExam } from "../../exams/final-stretch/final-stretch-rules";
import { practicesShortAnswers } from "../../library/exams/short-answers";
import { getGoalField } from "../../library/items/item-field";
import {
  type AlphabetIntro,
  loadAlphabetIntro,
} from "../../library/language/alphabet/alphabet-intro";
import { getItemKey } from "../../plans/planner/plan-items";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { type PlannedLesson, type SessionBuildInput, buildSessionBlocks } from "../session-builder";
import { listDayCheckpoints, loadDayBosses } from "./day-checkpoints";
import { pickDayLessons } from "./day-lessons";
import { isMockOnlyDay } from "./day-mock";
import { loadDayPlan } from "./day-plan";
import {
  getDayFreshStart,
  getDayPracticeShare,
  getDayWritingMinutes,
  getPlanTestSkillIds,
} from "./day-plan-facts";
import { findPlannedReview } from "./day-review";
import { listFittingLessons } from "./day-stretch";
import { type DayPracticeQuery, type DayWork, loadDayWork, loadHeldDayInput } from "./day-work";
import { getExamPrepAccess } from "./exam-access";
import { loadDayPlanLessons } from "./load-plan-lessons";
import { getReviewHorizon, loadReviewCapsules } from "./load-review-capsules";
import { getPlanTopics } from "./practice-blocks";
import { loadReviewsAndClaims } from "./practice-claims";
import { getPracticeDifficulty } from "./practice-difficulty";
import { getPracticeWeights } from "./review-skills";
import { type SelectedDayPlan } from "./selected-day-plan";
import { type SessionDayContext } from "./session-placement";

type BuildContext = SessionDayContext;

/** A new script's alphabet is outside the plan and stays first until finished, skipped, or demonstrated known. */
function toAlphabetLessons(alphabet: AlphabetIntro | null): PlannedLesson[] {
  if (!alphabet?.pending) {
    return [];
  }

  return [
    {
      canDo: alphabet.canDo,
      chapterId: null,
      lessonId: alphabet.lessonId,
      minutes: alphabet.minutes,
      planItemId: null,
      planSkillId: null,
      skillIds: [],
      title: alphabet.title,
    },
  ];
}

function toReviewInput({
  context: { goal, localDate, timeZone, userId },
  field,
  netScored,
  plan,
}: {
  context: BuildContext;
  field: string | null;
  netScored: boolean;
  plan: Awaited<ReturnType<typeof loadDayPlan>>;
}): Parameters<typeof loadReviewCapsules>[0] {
  return {
    dailyMinutes: goal.dailyMinutes,
    examBlueprintId: goal.examBlueprintId,
    field,
    horizon: getReviewHorizon({
      finalStretchStart: plan.finalStretchStart,
      goal,
      localDate,
      timeZone,
    }),
    listeningSkillIds: plan.listeningSkillIds,
    netScoring: netScored,
    planLessons: plan.items.flatMap((item) =>
      item.lessonId ? [{ ...item, lessonId: item.lessonId }] : [],
    ),
    skillIds: plan.skills.map((skill) => skill.id),
    userId,
  };
}

/** Weakest-topic review fills otherwise empty days, but cannot invent review material for a learner who studied nothing. */
async function finalizeBuildInput({
  input,
  keepsBlocks,
  plan,
  review,
  today,
}: {
  input: SessionBuildInput;
  keepsBlocks: boolean;
  plan: Awaited<ReturnType<typeof loadDayPlan>>;
  review: Parameters<typeof loadReviewCapsules>[0];
  today: Date;
}): Promise<SessionBuildInput> {
  const { blocks } = buildSessionBlocks(input);
  const ready = { ...input, freshStart: getDayFreshStart({ blocks, plan, today }) };

  if (keepsBlocks || blocks.length > 0) {
    return ready;
  }

  const capsules = await loadReviewCapsules({ ...review, weakest: true });

  return capsules.length > 0 ? { ...ready, capsules, weakestReview: true } : ready;
}

type SessionBuildContext = BuildContext & {
  /** A day retaining blocks is not empty and must not get a weakest-topic fallback review. */
  keepsBlocks?: boolean;
  /** Look ahead past retained lessons rather than letting them consume new-lesson slots. */
  keptLessonIds?: ReadonlySet<string>;
  selection?: SelectedDayPlan;
  dayPlan?: Awaited<ReturnType<typeof loadDayPlan>> | ReturnType<typeof loadDayPlan>;
};

/** Loads day inputs without persisting a session; selected plans and supplied facts must remain the caller's chosen state. */
export async function loadSessionBuildInput(
  context: SessionBuildContext,
): Promise<SessionBuildInput> {
  const { goal, keepsBlocks = false, keptLessonIds, localDate, now, userId } = context;

  const plan = await (context.dayPlan ?? loadDayPlan(context));
  const awaitingOutlines = plan.outlines === "awaiting";

  const { dayMinutes, listeningSkillIds, textSkillIds } = plan;
  const skillIds = plan.skills.map((skill) => skill.id);
  const field = getGoalField(goal.details);
  const netScored = isNetScored(plan.structure);

  const { heldSkillIds, learnItems, fillItems, reservedItems } = pickDayLessons({
    awaitingOutlines,
    goal,
    heldDay: context.selection !== undefined,
    localDate,
    plan,
  });

  const testSkillIds = getPlanTestSkillIds(plan);

  const access = getExamPrepAccess({ examPrep: plan.examPrep, goal });
  const review = toReviewInput({ context, field, netScored, plan });

  const dayLessons = loadDayPlanLessons({
    dayMinutes,
    fillItems,
    keptLessonIds,
    learnItems,
    paceFactor: parsePlanSettings(plan.settings).pace?.factor,
  });

  const [
    { lessons: planLessons, fillLessons },
    alphabet,
    { capsules: dueCapsules, claims },
    boss,
    weekly,
    produce,
  ] = await Promise.all([
    dayLessons,
    loadAlphabetIntro({ goal, userId }),
    loadReviewsAndClaims({
      claims: { goal, graph: plan.graph, now, skillIds: testSkillIds, today: localDate, userId },
      readClaims: context.readClaims,
      review,
    }),
    dayLessons.then((loaded) =>
      loadDayBosses({
        ahead: listFittingLessons({
          items: plan.items,
          lessons: [...loaded.lessons, ...loaded.fillLessons],
          minutes: dayMinutes,
        }),
        context,
        plan,
      }),
    ),
    loadSessionWeeklyChallenge({
      goal,
      includesMockExams: access.includesMockExams,
      items: plan.items,
      mockFunding: context.selection?.state.settings.mockFunding,
      mockSkillIds: testSkillIds,
      now,
      skillIds: textSkillIds,
      structure: plan.structure,
      today: localDate,
      userId,
    }),
    // Written exam tasks must remain practiced even when their topics' lessons do not fit before the test.
    loadSessionProduce({
      goal,
      planSettings: plan.settings,
      skillIds: testSkillIds,
      structure: plan.structure,
      today: localDate,
      userId,
    }),
  ]);

  const lessons = [...toAlphabetLessons(alphabet), ...planLessons];
  const checkpoints = listDayCheckpoints({ boss, items: plan.items, weekly });

  // A Plus-only mock day gives free learners a full review of every test topic instead.
  const fullReview = weekly.plusRequired;
  const reviewDay = findPlannedReview({ items: plan.items, today: localDate });
  const isReviewDay = fullReview || reviewDay !== null;

  const practiceQuery: DayPracticeQuery = {
    claims,
    difficultyBias: getPracticeDifficulty({
      daysToExam: getDaysToExam({ targetDate: goal.targetDate, today: localDate }),
      hasLessonsLeft: learnItems.length > 0,
      settings: plan.settings,
    }),
    everySkill: fullReview,
    examBlueprintId: goal.examBlueprintId,
    field,
    firstSkillIds: heldSkillIds,
    ...getPracticeWeights({ ...plan, isReviewDay }),
    listeningSkillIds,
    maxMinutes: dayMinutes,
    now,
    repeatOnlyMissed: isReviewDay,
    skillIds: fullReview ? testSkillIds : skillIds,
    typed: practicesShortAnswers({ goal, structure: plan.structure }),
    userId,
  };

  const base: Omit<SessionBuildInput, keyof DayWork> = {
    checkpoints,
    dailyMinutes: dayMinutes,

    fillLessons,
    freshStart: getDayFreshStart({ plan, today: localDate }),
    fullReviewSkillIds: fullReview ? testSkillIds : null,
    lastSessionChallenges: plan.lastSessionChallenges,
    lessons,
    mockReplacesDay: isMockOnlyDay({
      goal,
      hasMock: checkpoints.some((checkpoint) => checkpoint.mock),
      items: plan.items,
      planSettings: plan.settings,
      today: localDate,
    }),
    netScored,
    planItems: plan.items,
    practiceShare: getDayPracticeShare({ goal, items: plan.items, today: localDate }),
    produce,
    reviewPlanItemId: reviewDay?.id ?? null,
    reviewPlanItemKey: reviewDay ? (reviewDay.key ?? getItemKey(reviewDay)) : null,
    topics: getPlanTopics({ goal, graph: plan.graph }),
    writingMinutes: getDayWritingMinutes({ reservedItems, today: localDate }),
  };

  const work = { context, dueCapsules, isReviewDay, plan, practiceQuery };

  return loadHeldDayInput({
    checkpoints,
    loadInput: async (checkpointItems) =>
      finalizeBuildInput({
        input: { ...base, ...(await loadDayWork({ ...work, checkpointItems })) },
        keepsBlocks,
        plan,
        review,
        today: localDate,
      }),
  });
}
