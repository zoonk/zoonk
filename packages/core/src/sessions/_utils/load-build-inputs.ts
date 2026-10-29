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
import { LEARN_KINDS, isWritingItem } from "../../plans/planner/plan-item-rules";
import { type BlockDrill } from "../block-payload";
import { getFreshStart } from "../fresh-start";
import { getPracticeShare } from "../practice-share";
import { type PlannedLesson, type SessionBuildInput, buildSessionBlocks } from "../session-builder";
import { loadDayCapsules } from "./day-capsules";
import { listDayCheckpoints, loadDayBosses } from "./day-checkpoints";
import { pickDayLessons } from "./day-lessons";
import { loadDayPlan } from "./day-plan";
import { findPlannedReview } from "./day-review";
import { getExamPrepAccess } from "./exam-access";
import { markLessonsAroundChallenges } from "./lessons-before-challenges";
import { loadMistakeDrills } from "./load-mistake-drills";
import { loadUpcomingLessons } from "./load-plan-lessons";
import { loadPracticeItems } from "./load-practice";
import { getReviewHorizon, loadReviewCapsules } from "./load-review-capsules";
import { isDayAwaitingOutlines } from "./outlining-stand-ins";
import { loadReviewsAndClaims } from "./practice-claims";
import { getPracticeDifficulty } from "./practice-difficulty";
import { getFocusedSkillIds, getTestSkillIds } from "./review-skills";
import { type SelectedDayPlan } from "./selected-day-plan";
import { type SessionDayContext, loadSessionPlacement } from "./session-placement";
import { type SessionPlanItem } from "./session-plan-item";

function isNewPhase(items: readonly SessionPlanItem[]): boolean {
  const phase = items.find(
    (item) => LEARN_KINDS.has(item.kind) && item.status === "todo" && !isWritingItem(item),
  )?.phase;

  return (
    phase !== undefined &&
    phase > 0 &&
    items.every((item) => item.phase !== phase || item.status === "todo")
  );
}

function getPlanProgress(items: readonly SessionPlanItem[]): number {
  return items.filter((item) => item.status !== "todo").length / Math.max(1, items.length);
}

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

function getDayFreshStart({
  plan,
  today,
}: {
  plan: Pick<
    Awaited<ReturnType<typeof loadDayPlan>>,
    "isFirstDay" | "items" | "lastStudyDate" | "planStart"
  >;
  today: Date;
}) {
  return getFreshStart({
    isFirstDay: plan.isFirstDay,
    isNewPhase: isNewPhase(plan.items),
    lastStudyDate: plan.lastStudyDate,
    startDate: plan.planStart,
    today,
  });
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

function getPlanTestSkillIds(plan: Awaited<ReturnType<typeof loadDayPlan>>): string[] {
  return getTestSkillIds({
    graph: plan.graph,
    planSkillIds: plan.skills.map((skill) => skill.id),
    settings: plan.settings,
  });
}

/** Loads day inputs without persisting a session; selected plans and supplied facts must remain the caller's chosen state. */
export async function loadSessionBuildInput(
  context: BuildContext & {
    /** A day retaining blocks is not empty and must not get a weakest-topic fallback review. */
    keepsBlocks?: boolean;
    /** Look ahead past retained lessons rather than letting them consume new-lesson slots. */
    keptLessonIds?: ReadonlySet<string>;
    selection?: SelectedDayPlan;
    dayPlan?: Awaited<ReturnType<typeof loadDayPlan>> | ReturnType<typeof loadDayPlan>;
  },
): Promise<SessionBuildInput> {
  const { goal, keepsBlocks = false, keptLessonIds, localDate, now, timeZone, userId } = context;

  const [plan, awaitingOutlines] = await Promise.all([
    context.dayPlan ?? loadDayPlan(context),
    isDayAwaitingOutlines({ goal, localDate }),
  ]);

  const { dayMinutes, listeningSkillIds, textSkillIds } = plan;
  const skillIds = plan.skills.map((skill) => skill.id);
  const field = getGoalField(goal.details);
  const netScored = isNetScored(plan.structure);

  const { heldSkillIds, learnItems } = pickDayLessons({
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
    planLessons,
    alphabet,
    { capsules: dueCapsules, claims },
    dueDrills,
    boss,
    weekly,
    produce,
  ] = await Promise.all([
    loadUpcomingLessons({ dayMinutes, items: learnItems, keptLessonIds }),
    loadAlphabetIntro({ goal, userId }),
    loadReviewsAndClaims({
      claims: { goal, graph: plan.graph, now, skillIds: testSkillIds, today: localDate, userId },
      practiceLocked: access.trialEnded,
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
    loadDayBosses({
      access,
      examBlueprintId: goal.examBlueprintId,
      goal,
      graphSkills: plan.graph.skills,
      itemSkillIds: plan.itemSkillIds,
      items: plan.items,
      listeningSkillIds,
      skills: plan.skills,
      today: localDate,
      userId,
    }),
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
    focusSkillIds: isReviewDay
      ? getFocusedSkillIds({ graph: plan.graph, settings: plan.settings })
      : undefined,
    listeningSkillIds,
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
    freshStart: getDayFreshStart({ plan, today: localDate }),
    fullReviewSkillIds: fullReview ? testSkillIds : null,
    lessons,
    netScored,
    placementItemIds,
    practice,
    practiceShare: getPracticeShare({
      daysToExam: getDaysToExam({ targetDate: goal.targetDate, today: localDate }),
      planProgress: getPlanProgress(plan.items),
    }),
    produce,
    reinforcement: boss.reinforcement,
    remainingLimitMinutes: plan.limit.remainingMinutes,
    reviewPlanItemId: reviewDay?.id ?? null,
    reviewPlanItemKey: reviewDay?.key ?? null,
  };

  return keepsBlocks ? input : withWeakestReview({ input, review });
}
