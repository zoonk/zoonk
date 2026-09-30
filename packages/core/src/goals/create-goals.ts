import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearningProfileCacheTag } from "../cache/tags";
import { claimUsage } from "../entitlements/claim-usage";
import { type UsageDecision } from "../entitlements/contract";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { libraryRowsVisibleTo } from "../library/_utils/library-visibility";
import { fromIsoDate, toIsoDate } from "../plans/planner/plan-calendar";
import { DAYS_PER_WEEK } from "../plans/planner/plan-state";
import { getSession } from "../users/get-session";
import { findActiveGoalId, loadGoalViews } from "./_utils/goal-view";
import { splitDailyBudget } from "./daily-budget";
import { type GoalCreateInput, type GoalDraft, type GoalView } from "./goal-contract";

/** Why one goal wasn't created: the plan's goal limits, or too many requests at once. */
export type GoalRefusal = {
  decision: Extract<UsageDecision, { status: "limitReached" | "slowDown" }>;
  index: number;
};

export type GoalCreateResult =
  | { goals: GoalView[]; refused: GoalRefusal[]; status: "created" }
  | { refused: GoalRefusal[]; status: "refused" }
  | { status: "invalidReference" }
  | { status: "unauthorized" };

/** Study days become a weekly shape with rest days at zero; every day needs no shape. */
function getWeekdayMinutes({
  dailyMinutes,
  studyDays,
}: {
  dailyMinutes: number;
  studyDays?: number[];
}) {
  if (!studyDays || new Set(studyDays).size === DAYS_PER_WEEK) {
    return null;
  }

  return Array.from({ length: DAYS_PER_WEEK }, (_, weekday) =>
    studyDays.includes(weekday) ? dailyMinutes : 0,
  );
}

/** Exams and courses a goal points at must exist, and a private one must be the learner's. */
async function hasValidReferences({ goals, userId }: { goals: GoalDraft[]; userId: string }) {
  const blueprintIds = [...new Set(goals.flatMap((goal) => goal.examBlueprintId ?? []))];
  const courseIds = [...new Set(goals.flatMap((goal) => goal.primaryCourseId ?? []))];

  const [blueprints, courses] = await Promise.all([
    prisma.examBlueprint.count({
      where: { ...libraryRowsVisibleTo(userId), id: { in: blueprintIds } },
    }),
    prisma.course.count({
      where: { OR: [{ visibility: "public" }, { userId }], id: { in: courseIds } },
    }),
  ]);

  return blueprints === blueprintIds.length && courses === courseIds.length;
}

/** Goals without their own minutes share the day's time; the first of them is the main one. */
function assignDailyMinutes(input: GoalCreateInput): number[] {
  const shared = input.goals.filter((goal) => goal.dailyMinutes === undefined).length;
  const split = splitDailyBudget({ budget: input.dailyMinutes, count: shared });

  return input.goals.map((goal, index) => {
    const sharedBefore = input.goals
      .slice(0, index)
      .filter((other) => other.dailyMinutes === undefined);

    return goal.dailyMinutes ?? split[sharedBefore.length] ?? input.dailyMinutes;
  });
}

async function createGoal({
  dailyMinutes,
  draft,
  id,
  input,
  userId,
}: {
  dailyMinutes: number;
  draft: GoalDraft;
  id: string;
  input: GoalCreateInput;
  userId: string;
}): Promise<void> {
  const timeZone = getAnswerTimeZone({ goal: null, timeZone: input.timeZone });

  await prisma.$transaction([
    prisma.goal.create({
      data: {
        dailyMinutes,
        details: draft.details ?? {},
        examBlueprintId: draft.examBlueprintId ?? null,
        id,
        kind: draft.kind,
        language: draft.language,
        primaryCourseId: draft.primaryCourseId ?? null,
        prompt: draft.prompt,
        studyTime: input.studyTime ?? null,
        targetDate: draft.targetDate ? fromIsoDate(draft.targetDate) : null,
        targetLanguage: draft.targetLanguage ?? null,
        timezone: input.timeZone ?? null,
        title: draft.title,
        userId,
      },
    }),
    prisma.plan.create({
      data: {
        goalId: id,
        settings: {
          startDate: toIsoDate(getDateInTimeZone({ date: new Date(), timeZone })),
          weekdayMinutes: getWeekdayMinutes({ dailyMinutes, studyDays: input.studyDays }),
        },
      },
    }),
  ]);
}

/**
 * A quick question doesn't take over the tabs: the goal the learner follows stays, and the
 * explanation only becomes the active goal when there's none.
 */
async function chooseActiveGoalId({
  input,
  mainId,
  userId,
}: {
  input: GoalCreateInput;
  mainId: string;
  userId: string;
}): Promise<string> {
  if (input.goals.some((goal) => goal.kind !== "explain")) {
    return mainId;
  }

  return (await findActiveGoalId(userId)) ?? mainId;
}

/** A goal that replaced it only counts when the replaced goal is the learner's own. */
async function isOwnGoal({ goalId, userId }: { goalId?: string; userId: string }) {
  return goalId ? (await prisma.goal.count({ where: { id: goalId, userId } })) > 0 : false;
}

/**
 * Creates the learner's goals from onboarding with an empty plan the planner fills. Each goal is
 * claimed against the learner's plan first (free learners follow one active goal), and the ones
 * allowed are created even when a later one isn't. The first new goal becomes the one the tabs
 * show: it's the main goal, whose session comes first. A goal that replaces one of the learner's
 * (`replacesGoalId`, a language goal moving to its exam) isn't another goal, so it claims nothing.
 */
export async function createGoals(
  input: GoalCreateInput,
  { replacesGoalId }: { replacesGoalId?: string } = {},
): Promise<GoalCreateResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  if (!(await hasValidReferences({ goals: input.goals, userId }))) {
    return { status: "invalidReference" };
  }

  const minutes = assignDailyMinutes(input);
  const replacing = await isOwnGoal({ goalId: replacesGoalId, userId });

  /** One at a time, so each claim counts the goals created before it. */
  const results = await input.goals.reduce<Promise<{ ids: string[]; refused: GoalRefusal[] }>>(
    async (previous, draft, index) => {
      const state = await previous;
      const id = crypto.randomUUID();

      const decision = replacing
        ? ({ status: "allowed" } as const)
        : await claimUsage({
            // An explanation always asks a model: to classify and find the question, if not write it.
            generated: draft.kind === "explain",
            kind: draft.kind === "explain" ? "explanation" : "goal",
            targetId: id,
          });

      if (decision.status === "unauthorized") {
        return state;
      }

      if (decision.status !== "allowed") {
        return { ...state, refused: [...state.refused, { decision, index }] };
      }

      await createGoal({
        dailyMinutes: minutes[index] ?? input.dailyMinutes,
        draft,
        id,
        input,
        userId,
      });

      return { ...state, ids: [...state.ids, id] };
    },
    Promise.resolve({ ids: [], refused: [] }),
  );

  const [mainId] = results.ids;

  if (!mainId) {
    return { refused: results.refused, status: "refused" };
  }

  const activeGoalId = await chooseActiveGoalId({ input, mainId, userId });

  await prisma.userLearningProfile.upsert({
    create: { activeGoalId, userId },
    update: { activeGoalId },
    where: { userId },
  });

  revalidateCacheTags([getGoalsCacheTag(userId), getLearningProfileCacheTag(userId)]);

  const rows = await prisma.goal.findMany({ where: { id: { in: results.ids } } });
  const goals = results.ids.flatMap((id) => rows.find((goal) => goal.id === id) ?? []);

  return {
    goals: await loadGoalViews({ activeGoalId, goals }),
    refused: results.refused,
    status: "created",
  };
}
