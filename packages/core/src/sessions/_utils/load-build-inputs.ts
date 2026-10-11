import "server-only";
import { type PlanItem } from "@zoonk/db";
import { loadSessionBosses } from "../../checkpoints/_utils/load-boss";
import { loadSessionWeeklyChallenge } from "../../checkpoints/_utils/load-weekly-challenge";
import { isNetScored } from "../../checkpoints/weekly-challenge-rules";
import { loadSessionProduce } from "../../exams/essays/_utils/load-produce";
import { getDaysToExam } from "../../exams/final-stretch/final-stretch-rules";
import { getGoalField } from "../../library/items/item-field";
import {
  type AlphabetIntro,
  loadAlphabetIntro,
} from "../../library/language/alphabet/alphabet-intro";
import { isWritingItem } from "../../plans/_utils/plan-phase-views";
import { type BlockDrill } from "../block-payload";
import { getFreshStart } from "../fresh-start";
import { getPracticeShare } from "../practice-share";
import { type PlannedLesson, type SessionBuildInput, buildSessionBlocks } from "../session-builder";
import { loadDayCapsules } from "./day-capsules";
import { LEARN_KINDS, getLessonLookahead, pickDayLessons } from "./day-lessons";
import { loadDayPlan } from "./day-plan";
import { getExamPrepAccess } from "./exam-access";
import { markLessonsBeforeChallenges } from "./lessons-before-challenges";
import { loadMistakeDrills } from "./load-mistake-drills";
import { loadPlanLessons } from "./load-plan-lessons";
import { loadPracticeItems } from "./load-practice";
import { getReviewHorizon, loadReviewCapsules } from "./load-review-capsules";
import { isDayAwaitingOutlines } from "./outlining-stand-ins";
import { loadReviewsAndClaims } from "./practice-claims";
import { getPracticeDifficulty } from "./practice-difficulty";
import { getFocusedSkillIds, getTestSkillIds } from "./review-skills";
import { type SessionDayContext, loadSessionPlacement } from "./session-placement";

/** A review day the plan scheduled for today or earlier and the learner hasn't done yet. */
function findReviewDay({ items, today }: { items: readonly PlanItem[]; today: Date }) {
  return items.find(
    (item) =>
      item.kind === "review" &&
      item.status === "todo" &&
      item.scheduledFor !== null &&
      item.scheduledFor <= today,
  );
}

/** The first day in a phase: nothing in it is done yet, and it isn't the plan's first phase. */
function isNewPhase(items: readonly PlanItem[]): boolean {
  const phase = items.find(
    (item) => LEARN_KINDS.has(item.kind) && item.status === "todo" && !isWritingItem(item),
  )?.phase;

  return (
    phase !== undefined &&
    phase > 0 &&
    items.every((item) => item.phase !== phase || item.status === "todo")
  );
}

function getPlanProgress(items: readonly PlanItem[]): number {
  return items.length === 0
    ? 0
    : items.filter((item) => item.status !== "todo").length / items.length;
}

/** A question the checkpoint asks is answered there; answering it right fixes its mistake too. */
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

/**
 * A language whose script isn't Latin opens a new learner's sessions with its alphabet lesson,
 * outside the plan, until they finish it, skip it or show they read the script.
 */
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

/** What the day's quick review reads (see `loadReviewCapsules`). */
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

/**
 * A day with nothing due and nothing else to study (no lesson, practice, drill or challenge) is
 * never empty: it reviews the learner's weakest studied topics instead, briefly, and says so
 * (`weakestReview`). A learner who studied nothing yet still has an empty day.
 */
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

/**
 * Loads everything the day's session is built from: the alphabet first for a new script, the
 * plan's next lessons, today's capsules, a mistake to fix, mixed practice (with a question on each
 * topic the learner was taken to know, whatever the plan teaches; see `loadPracticeClaims`), a
 * day's bosses or weekly checkpoint when due, and the day's shape (fresh start, practice share, the
 * learner's daily limit, what a free exam plan covers).
 */
export async function loadSessionBuildInput(
  context: BuildContext & {
    /**
     * The day is underway and keeps blocks it already holds: it isn't empty, so it never gets a
     * review of the weakest topics (`withWeakestReview`).
     */
    keepsBlocks?: boolean;
  },
): Promise<SessionBuildInput> {
  const { goal, keepsBlocks = false, localDate, now, timeZone, userId } = context;

  const [plan, awaitingOutlines] = await Promise.all([
    loadDayPlan(context),
    isDayAwaitingOutlines({ goal, localDate }),
  ]);

  const { dayMinutes, listeningSkillIds, textSkillIds } = plan;
  const skillIds = plan.skills.map((skill) => skill.id);
  const field = getGoalField(goal.details);
  const netScored = isNetScored(plan.structure);

  const { heldSkillIds, learnItems } = pickDayLessons({ awaitingOutlines, goal, localDate, plan });

  // Every topic of the test, the ones its days left out too: what a mock asks, and the full
  // review a free plan gets on a mock's day.
  const testSkillIds = getTestSkillIds({
    graph: plan.graph,
    planSkillIds: skillIds,
    settings: plan.settings,
  });

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
    loadPlanLessons({ items: learnItems.slice(0, getLessonLookahead(dayMinutes)), userId }),
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
    loadSessionBosses({
      examBlueprintId: goal.examBlueprintId,
      goalKind: goal.kind,
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
      mockSkillIds: testSkillIds,
      now,
      skillIds: textSkillIds,
      structure: plan.structure,
      today: localDate,
      userId,
    }),
    // The exam's written answers are practiced whatever its days have room for: a class test's
    // announced essay comes up even when its topic's lessons don't fit.
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
    ...markLessonsBeforeChallenges({
      checkpoints: boss.checkpoints,
      items: plan.items,
      lessons: planLessons,
    }),
  ];

  const checkpoints =
    boss.checkpoints.length > 0
      ? boss.checkpoints
      : [weekly.checkpoint].filter((entry) => entry !== null);

  const checkpointItems = new Set(checkpoints.flatMap((checkpoint) => checkpoint.itemIds));

  const drills = withoutCheckpointItems({ checkpointItems, drills: dueDrills });

  const reserved = new Set([...drills.flatMap((drill) => drill.itemIds), ...checkpointItems]);

  // A mock the learner's plan doesn't include (a free plan's) leaves its day to a full review of
  // every topic of the test, the ones its days left out too.
  const fullReview = weekly.plusRequired;
  const reviewPlanItemId = findReviewDay({ items: plan.items, today: localDate })?.id ?? null;
  const isReviewDay = fullReview || reviewPlanItemId !== null;

  const capsules = await loadDayCapsules({ capsules: dueCapsules, isReviewDay, reserved, userId });

  const used = new Set([...reserved, ...capsules.flatMap((capsule) => capsule.itemIds)]);

  const placementItemIds = await loadSessionPlacement({ context, isReviewDay, plan, used });

  const reviewSkillIds = fullReview ? testSkillIds : skillIds;

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
    skillIds: reviewSkillIds,
    userId,
  });

  const input: SessionBuildInput = {
    capsules,
    checkpoints,
    dailyMinutes: dayMinutes,
    drills,
    examTrialEnded: access.trialEnded,
    freshStart: getFreshStart({
      isFirstDay: plan.isFirstDay,
      isNewPhase: isNewPhase(plan.items),
      lastStudyDate: plan.lastStudyDate,
      startDate: plan.planStart,
      today: localDate,
    }),
    fullReviewSkillIds: fullReview ? reviewSkillIds : null,
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
    reviewPlanItemId,
  };

  return keepsBlocks ? input : withWeakestReview({ input, review });
}
