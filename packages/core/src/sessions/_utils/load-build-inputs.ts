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
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { type BlockDrill } from "../block-payload";
import { type PlannedLesson, type SessionBuildInput, buildSessionBlocks } from "../session-builder";
import { loadDayCapsules } from "./day-capsules";
import { listDayCheckpoints, loadDayBosses } from "./day-checkpoints";
import { pickDayLessons } from "./day-lessons";
import { loadDayPlan } from "./day-plan";
import {
  getDayFreshStart,
  getDayPracticeShare,
  getDayWritingMinutes,
  getPlanTestSkillIds,
} from "./day-plan-facts";
import { findPlannedReview } from "./day-review";
import { getExamPrepAccess } from "./exam-access";
import { markLessonsAroundChallenges } from "./lessons-before-challenges";
import { loadMistakeDrills } from "./load-mistake-drills";
import { loadDayPlanLessons } from "./load-plan-lessons";
import { loadPracticeItems } from "./load-practice";
import { getReviewHorizon, loadReviewCapsules } from "./load-review-capsules";
import { getPlanTopics } from "./practice-blocks";
import { loadReviewsAndClaims } from "./practice-claims";
import { getPracticeDifficulty } from "./practice-difficulty";
import { getPracticeWeights } from "./review-skills";
import { type SelectedDayPlan } from "./selected-day-plan";
import { type SessionDayContext, loadSessionPlacement } from "./session-placement";

/** Checkpoint questions must stay out of drills; a correct checkpoint answer fixes their mistake too. */
function withoutCheckpointItems({
  checkpointItems,
  drills,
}: {
  checkpointItems: ReadonlySet<string>;
  drills: readonly BlockDrill[];
}): BlockDrill[] {
  return drills
    .map((drill) => ({ ...drill, itemIds: drill.itemIds.filter((id) => !checkpointItems.has(id)) }))
    .filter((drill) => drill.itemIds.length > 0);
}

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
async function withWeakestReview({
  input,
  review,
}: {
  input: SessionBuildInput;
  review: Parameters<typeof loadReviewCapsules>[0];
}): Promise<SessionBuildInput> {
  if (buildSessionBlocks(input).blocks.length > 0) {
    return input;
  }

  const capsules = await loadReviewCapsules({ ...review, weakest: true });

  return capsules.length > 0 ? { ...input, capsules, weakestReview: true } : input;
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
  const { goal, keepsBlocks = false, keptLessonIds, localDate, now, timeZone, userId } = context;

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

  const access = getExamPrepAccess({ examPrep: plan.examPrep, goal, timeZone, today: localDate });
  const review = toReviewInput({ context, field, netScored, plan });

  const [
    { lessons: planLessons, fillLessons },
    alphabet,
    { capsules: dueCapsules, claims },
    dueDrills,
    boss,
    weekly,
    produce,
  ] = await Promise.all([
    loadDayPlanLessons({
      dayMinutes,
      fillItems,
      keptLessonIds,
      learnItems,
      paceFactor: parsePlanSettings(plan.settings).pace?.factor,
    }),
    loadAlphabetIntro({ goal, userId }),
    loadReviewsAndClaims({
      claims: { goal, graph: plan.graph, now, skillIds: testSkillIds, today: localDate, userId },
      practiceLocked: access.trialEnded,
      readClaims: context.readClaims,
      review,
    }),
    loadMistakeDrills({
      examBlueprintId: goal.examBlueprintId,
      field,
      listeningSkillIds,
      skills: plan.skills,
      timeZone,
      today: localDate,
      userId,
    }),
    loadDayBosses({ access, context, plan }),
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

  const lessons = [
    ...toAlphabetLessons(alphabet),
    ...markLessonsAroundChallenges({
      checkpoints: boss.checkpoints,
      items: plan.items,
      lessons: planLessons,
      today: localDate,
    }),
  ];

  const checkpoints = listDayCheckpoints({ access, boss, weekly });

  const checkpointItems = new Set(checkpoints.flatMap((checkpoint) => checkpoint.itemIds));

  const drills = withoutCheckpointItems({ checkpointItems, drills: dueDrills });

  const reserved = new Set([...drills.flatMap((drill) => drill.itemIds), ...checkpointItems]);

  // A Plus-only mock day gives free learners a full review of every test topic instead.
  const fullReview = weekly.plusRequired;
  const reviewDay = findPlannedReview({ items: plan.items, today: localDate });
  const isReviewDay = fullReview || reviewDay !== null;

  const capsules = await loadDayCapsules({ capsules: dueCapsules, isReviewDay, reserved, userId });

  const used = new Set([...reserved, ...capsules.flatMap((capsule) => capsule.itemIds)]);

  const placementItemIds = await loadSessionPlacement({ context, isReviewDay, plan, used });

  const practice = await loadPracticeItems({
    claims,
    difficultyBias: getPracticeDifficulty({
      daysToExam: getDaysToExam({ targetDate: goal.targetDate, today: localDate }),
      hasLessonsLeft: learnItems.length > 0,
      settings: plan.settings,
    }),
    everySkill: fullReview,
    examBlueprintId: goal.examBlueprintId,
    excludeItemIds: new Set([...used, ...placementItemIds]),
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
  });

  const input: SessionBuildInput = {
    capsules,
    checkpoints,
    dailyMinutes: dayMinutes,
    drills,
    examTrialEnded: access.trialEnded,
    fillLessons: markLessonsAroundChallenges({
      checkpoints: boss.checkpoints,
      items: plan.items,
      lessons: fillLessons,
      today: localDate,
    }),
    freshStart: getDayFreshStart({ plan, today: localDate }),
    fullReviewSkillIds: fullReview ? testSkillIds : null,
    lessons,
    netScored,
    placementItemIds,
    practice,
    practiceShare: getDayPracticeShare({ goal, items: plan.items, today: localDate }),
    produce,
    reinforcement: boss.reinforcement,
    reviewPlanItemId: reviewDay?.id ?? null,
    reviewPlanItemKey: reviewDay?.key ?? null,
    topics: getPlanTopics(plan.graph),
    writingMinutes: getDayWritingMinutes({
      checkpoints: boss.checkpoints,
      items: plan.items,
      reservedItems,
      today: localDate,
    }),
  };

  return keepsBlocks ? input : withWeakestReview({ input, review });
}
