import "server-only";
import { type Goal, type PlanItem, prisma } from "@zoonk/db";
import { loadSessionBoss } from "../../checkpoints/_utils/load-boss";
import { loadSessionWeeklyChallenge } from "../../checkpoints/_utils/load-weekly-challenge";
import { isNetScored } from "../../checkpoints/weekly-challenge-rules";
import { getAllowance } from "../../entitlements/get-allowance";
import { loadSessionProduce } from "../../exams/essays/_utils/load-produce";
import { getDaysToExam, getFinalStretchStart } from "../../exams/final-stretch/final-stretch-rules";
import { withClassTestMock } from "../../exams/mocks/class-test-mock";
import { loadGoalPlan } from "../../learner/_utils/goal-skill-graph";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { getGoalField } from "../../library/items/item-field";
import {
  type AlphabetIntro,
  loadAlphabetIntro,
} from "../../library/language/alphabet/alphabet-intro";
import { getDailyTimeLimitStatus } from "../../minors/get-daily-time-limit";
import { isWritingItem } from "../../plans/_utils/plan-phase-views";
import { parsePlanGraph, parsePlanPhases } from "../../plans/planner/plan-state";
import { type BlockCapsule } from "../block-payload";
import { getFreshStart } from "../fresh-start";
import { type PlannedLesson, type SessionBuildInput, getPracticeShare } from "../session-builder";
import { getLessonLookahead, pickDayLessonItems } from "./day-lessons";
import { getGoalDayMinutes } from "./day-minutes";
import { getExamPrepAccess } from "./exam-access";
import { loadPlanLessons } from "./load-plan-lessons";
import { loadMistakeDrills, loadPracticeItems } from "./load-practice";
import { getReviewHorizon, loadReviewCapsules } from "./load-review-capsules";
import { getPracticeDifficulty } from "./practice-difficulty";
import { getFocusedSkillIds, getTestSkillIds } from "./review-skills";
import { type SessionDayContext, loadSessionPlacement } from "./session-placement";

const LEARN_KINDS = new Set<PlanItem["kind"]>(["lesson", "chapter"]);

/**
 * How the goal's exam is structured and scored, from its blueprint; null for other goals. A class
 * test's short mock fits `dayMinutes`, the time of the day it's for, when given.
 */
export async function loadExamStructure(
  goal: Pick<Goal, "examBlueprintId">,
  { dayMinutes }: { dayMinutes?: number | null } = {},
): Promise<ExamStructure | null> {
  if (!goal.examBlueprintId) {
    return null;
  }

  const blueprint = await prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } });

  return blueprint
    ? withClassTestMock({
        dayMinutes,
        ownerId: blueprint.ownerId,
        structure: readBlueprintContent(blueprint).structure,
      })
    : null;
}

/** Whether the goal had a day before this one: day one starts nothing over. */
async function hasEarlierDay({ goalId, today }: { goalId: string; today: Date }) {
  const earlier = await prisma.studySession.findFirst({
    select: { id: true },
    where: { goalId, localDate: { lt: today } },
  });

  return earlier !== null;
}

async function loadLastStudyDate({ today, userId }: { today: Date; userId: string }) {
  const day = await prisma.dailyProgress.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
    where: { date: { lt: today }, timeSpentSeconds: { gt: 0 }, userId },
  });

  return day?.date ?? null;
}

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

/**
 * A mistake's own question belongs to its drill, where fixing it counts for the mission, and a
 * checkpoint's questions stay unseen until the duel, so capsules leave both out. A capsule left
 * without questions is covered by the drill or checkpoint on its skill.
 */
function withoutReservedItems({
  capsules,
  reserved,
}: {
  capsules: readonly BlockCapsule[];
  reserved: ReadonlySet<string>;
}): BlockCapsule[] {
  return capsules
    .map((capsule) => ({ ...capsule, itemIds: capsule.itemIds.filter((id) => !reserved.has(id)) }))
    .filter((capsule) => capsule.itemIds.length > 0);
}

type BuildContext = SessionDayContext;

async function loadPlanContext({ goal, localDate, userId }: BuildContext) {
  const [plan, goalPlan, allowance, limit, lastStudyDate, hadEarlierDay] = await Promise.all([
    prisma.plan.findUnique({
      include: { items: { orderBy: { position: "asc" } } },
      where: { goalId: goal.id },
    }),
    loadGoalPlan(goal.id),
    getAllowance(),
    getDailyTimeLimitStatus(),
    loadLastStudyDate({ today: localDate, userId }),
    hasEarlierDay({ goalId: goal.id, today: localDate }),
  ]);

  // The day's mock fits the day: a class test's short mock takes the time the learner gives it.
  const dayMinutes = getGoalDayMinutes({ date: localDate, goal, planSettings: plan?.settings });
  const structure = await loadExamStructure(goal, { dayMinutes });

  return {
    allowance,
    dayMinutes,
    finalStretchStart: getFinalStretchStart(parsePlanPhases(plan?.phases)),
    graph: parsePlanGraph(plan?.graph),
    isFirstDay: !hadEarlierDay,
    items: plan?.items ?? [],
    lastStudyDate,
    limit,
    settings: plan?.settings ?? null,
    skills: goalPlan.skills,
    structure,
  };
}

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

/**
 * Loads everything the day's session is built from: the alphabet first for a new script, the
 * plan's next lessons, today's capsules, a mistake to fix, mixed practice, a boss or weekly
 * checkpoint when one is due, and the day's shape (fresh start, practice share, a guardian's
 * limit, what a free exam plan covers).
 */
export async function loadSessionBuildInput(context: BuildContext): Promise<SessionBuildInput> {
  const { goal, localDate, now, timeZone, userId } = context;
  const plan = await loadPlanContext(context);
  const { dayMinutes } = plan;
  const skillIds = plan.skills.map((skill) => skill.id);
  const field = getGoalField(goal.details);
  const netScored = isNetScored(plan.structure);

  // A stand-in for lessons the Library hasn't outlined yet has nothing to teach today, so it
  // doesn't take a lookahead slot from the written lessons after it; one due today keeps its time.
  const learnItems = pickDayLessonItems({
    graph: plan.graph,
    isExam: goal.kind === "exam",
    items: plan.items.filter((item) => LEARN_KINDS.has(item.kind) && item.status === "todo"),
    today: localDate,
  });

  // Every topic of the test, the ones its days left out too: what a mock asks, and the full
  // review a free plan gets on a mock's day.
  const testSkillIds = getTestSkillIds({
    graph: plan.graph,
    planSkillIds: skillIds,
    settings: plan.settings,
  });

  const access = getExamPrepAccess({
    examPrep: plan.allowance?.examPrep ?? null,
    goal,
    timeZone,
    today: localDate,
  });

  const [planLessons, alphabet, dueCapsules, dueDrills, boss, weekly, produce] = await Promise.all([
    loadPlanLessons({ items: learnItems.slice(0, getLessonLookahead(dayMinutes)), userId }),
    loadAlphabetIntro({ goal, userId }),
    loadReviewCapsules({
      dailyMinutes: goal.dailyMinutes,
      examBlueprintId: goal.examBlueprintId,
      field,
      horizon: getReviewHorizon({
        finalStretchStart: plan.finalStretchStart,
        goal,
        localDate,
        timeZone,
      }),
      netScoring: netScored,
      planLessonIds: new Set(plan.items.flatMap((item) => (item.lessonId ? [item.lessonId] : []))),
      skillIds,
      userId,
    }),
    loadMistakeDrills({
      examBlueprintId: goal.examBlueprintId,
      field,
      skillIds,
      timeZone,
      today: localDate,
      userId,
    }),
    loadSessionBoss({
      examBlueprintId: goal.examBlueprintId,
      goalKind: goal.kind,
      items: plan.items,
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
      skillIds,
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

  const lessons = [...toAlphabetLessons(alphabet), ...planLessons];
  const checkpoint = boss.checkpoint ?? weekly.checkpoint;
  const checkpointItems = new Set(checkpoint?.itemIds);

  // A question the checkpoint asks is answered there; answering it right fixes its mistake too.
  const drills = dueDrills
    .map((drill) => ({ ...drill, itemIds: drill.itemIds.filter((id) => !checkpointItems.has(id)) }))
    .filter((drill) => drill.itemIds.length > 0);

  const reserved = new Set([...drills.flatMap((drill) => drill.itemIds), ...checkpointItems]);

  const capsules = withoutReservedItems({ capsules: dueCapsules, reserved });
  const used = new Set([...reserved, ...capsules.flatMap((capsule) => capsule.itemIds)]);

  const placementItemIds = await loadSessionPlacement({
    context,
    skills: plan.skills,
    structure: plan.structure,
    used,
  });

  // A mock the learner's plan doesn't include (a free plan's) leaves its day to a full review of
  // every topic of the test, the ones its days left out too.
  const fullReview = weekly.plusRequired;
  const reviewPlanItemId = findReviewDay({ items: plan.items, today: localDate })?.id ?? null;

  const reviewSkillIds = fullReview ? testSkillIds : skillIds;

  const practice = await loadPracticeItems({
    difficultyBias: getPracticeDifficulty({
      daysToExam: getDaysToExam({ targetDate: goal.targetDate, today: localDate }),
      hasLessonsLeft: learnItems.length > 0,
      settings: plan.settings,
    }),
    everySkill: fullReview,
    examBlueprintId: goal.examBlueprintId,
    excludeItemIds: new Set([...used, ...placementItemIds]),
    field,
    focusSkillIds:
      fullReview || reviewPlanItemId
        ? getFocusedSkillIds({ graph: plan.graph, settings: plan.settings })
        : undefined,
    now,
    skillIds: reviewSkillIds,
    userId,
  });

  return {
    capsules,
    checkpoint,
    dailyMinutes: dayMinutes,
    drills,
    examTrialEnded: access.trialEnded,
    freshStart: getFreshStart({
      isFirstDay: plan.isFirstDay,
      isNewPhase: isNewPhase(plan.items),
      lastStudyDate: plan.lastStudyDate,
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
    reinforcement: boss.checkpoint ? boss.reinforcement : [],
    remainingLimitMinutes: plan.limit?.remainingMinutes ?? null,
    reviewPlanItemId,
  };
}
