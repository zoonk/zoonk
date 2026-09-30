import "server-only";
import { type Goal, type PlanItem, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { loadSessionBoss } from "../../checkpoints/_utils/load-boss";
import { loadSessionWeeklyChallenge } from "../../checkpoints/_utils/load-weekly-challenge";
import { isNetScored } from "../../checkpoints/weekly-challenge-rules";
import { getAllowance } from "../../entitlements/get-allowance";
import { loadSessionProduce } from "../../exams/essays/_utils/load-produce";
import { getDaysToExam, getFinalStretchStart } from "../../exams/final-stretch/final-stretch-rules";
import { withClassTestMock } from "../../exams/mocks/class-test-mock";
import { type GoalSkillNode, loadGoalPlan } from "../../learner/_utils/goal-skill-graph";
import { pickSessionPlacementItems } from "../../learner/placement/_utils/session-placement-items";
import {
  PLACEMENT_WEEK_DAYS,
  SESSION_PLACEMENT_QUESTIONS,
} from "../../learner/placement/placement-budget";
import { getPlacementQuickFormat } from "../../learner/placement/placement-quick-format";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { getGoalField } from "../../library/items/item-field";
import {
  type AlphabetIntro,
  loadAlphabetIntro,
} from "../../library/language/alphabet/alphabet-intro";
import { getDailyTimeLimitStatus } from "../../minors/get-daily-time-limit";
import { isWritingItem } from "../../plans/_utils/plan-phase-views";
import { daysBetween } from "../../plans/planner/plan-calendar";
import { parsePlanPhases, parsePlanSettings } from "../../plans/planner/plan-state";
import { type BlockCapsule } from "../block-payload";
import { getFreshStart } from "../fresh-start";
import { type PlannedLesson, type SessionBuildInput, getPracticeShare } from "../session-builder";
import { getGoalDayMinutes } from "./day-minutes";
import { getExamPrepAccess } from "./exam-access";
import { loadPlanLessons } from "./load-plan-lessons";
import { loadMistakeDrills, loadPracticeItems } from "./load-practice";
import { getReviewHorizon, loadReviewCapsules } from "./load-review-capsules";

/** Enough upcoming lessons to fill a long day; the builder takes what fits. */
const LESSON_LOOKAHEAD = 8;

const LEARN_KINDS = new Set<PlanItem["kind"]>(["lesson", "chapter"]);

/** How the goal's exam is structured and scored, from its blueprint; null for other goals. */
export async function loadExamStructure(
  goal: Pick<Goal, "examBlueprintId">,
): Promise<ExamStructure | null> {
  if (!goal.examBlueprintId) {
    return null;
  }

  const blueprint = await prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } });

  return blueprint
    ? withClassTestMock({
        ownerId: blueprint.ownerId,
        structure: readBlueprintContent(blueprint).structure,
      })
    : null;
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

type BuildContext = { goal: Goal; localDate: Date; now: Date; timeZone: string; userId: string };

/**
 * Placement's first week: a goal's sessions ask a few placement questions while a starting point
 * is unsure, unless the learner starts from nothing or chose to start from scratch.
 */
function asksPlacement({ goal, localDate, timeZone }: Omit<BuildContext, "now" | "userId">) {
  const details = isJsonObject(goal.details) ? goal.details : {};
  const created = getDateInTimeZone({ date: goal.createdAt, timeZone });
  const day = daysBetween(created, localDate);

  return (
    day >= 0 &&
    day < PLACEMENT_WEEK_DAYS &&
    details.level !== "none" &&
    details.placementDeclined !== true
  );
}

/** The first week's few placement questions, never ones a drill, capsule or checkpoint asks. */
async function loadSessionPlacement({
  context,
  skills,
  structure,
  used,
}: {
  context: BuildContext;
  skills: GoalSkillNode[];
  structure: ExamStructure | null;
  used: ReadonlySet<string>;
}): Promise<string[]> {
  if (!asksPlacement(context) || skills.length === 0) {
    return [];
  }

  return pickSessionPlacementItems({
    examBlueprintId: context.goal.examBlueprintId,
    excludeItemIds: used,
    limit: SESSION_PLACEMENT_QUESTIONS,
    quickFormat: getPlacementQuickFormat(structure),
    skills,
    userId: context.userId,
  });
}

async function loadPlanContext({ goal, localDate, userId }: BuildContext) {
  const [plan, goalPlan, structure, allowance, limit, lastStudyDate] = await Promise.all([
    prisma.plan.findUnique({
      include: { items: { orderBy: { position: "asc" } } },
      where: { goalId: goal.id },
    }),
    loadGoalPlan(goal.id),
    loadExamStructure(goal),
    getAllowance(),
    getDailyTimeLimitStatus(),
    loadLastStudyDate({ today: localDate, userId }),
  ]);

  return {
    allowance,
    finalStretchStart: getFinalStretchStart(parsePlanPhases(plan?.phases)),
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
  const skillIds = plan.skills.map((skill) => skill.id);
  const field = getGoalField(goal.details);
  const netScored = isNetScored(plan.structure);

  // A stand-in for lessons the Library hasn't outlined yet has nothing to teach today, so it
  // doesn't take a lookahead slot from the written lessons after it.
  const learnItems = plan.items.filter(
    (item) => LEARN_KINDS.has(item.kind) && item.status === "todo" && !isWritingItem(item),
  );

  const access = getExamPrepAccess({
    examPrep: plan.allowance?.examPrep ?? null,
    goal,
    timeZone,
    today: localDate,
  });

  const [planLessons, alphabet, dueCapsules, dueDrills, boss, weekly, produce] = await Promise.all([
    loadPlanLessons({ items: learnItems.slice(0, LESSON_LOOKAHEAD), userId }),
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
      now,
      skillIds,
      structure: plan.structure,
      today: localDate,
      userId,
    }),
    loadSessionProduce({ goal, skillIds, structure: plan.structure, today: localDate, userId }),
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

  const practice = await loadPracticeItems({
    difficultyBias: parsePlanSettings(plan.settings).difficultyBias,
    examBlueprintId: goal.examBlueprintId,
    excludeItemIds: new Set([...used, ...placementItemIds]),
    field,
    now,
    skillIds,
    userId,
  });

  return {
    capsules,
    checkpoint,
    dailyMinutes: getGoalDayMinutes({ date: localDate, goal, planSettings: plan.settings }),
    drills,
    examTrialEnded: access.trialEnded,
    freshStart: getFreshStart({
      isNewPhase: isNewPhase(plan.items),
      lastStudyDate: plan.lastStudyDate,
      today: localDate,
    }),
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
    reviewPlanItemId: findReviewDay({ items: plan.items, today: localDate })?.id ?? null,
  };
}
