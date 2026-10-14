import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearningProfileCacheTag } from "../cache/tags";
import { claimUsage } from "../entitlements/claim-usage";
import { type RefusedUsage } from "../entitlements/contract";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { libraryRowsVisibleTo } from "../library/_utils/library-visibility";
import { readTestedLanguage } from "../library/exams/blueprint-language";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { assertTargetDates } from "../plans/target-date-range";
import { getSession } from "../users/get-session";
import { createGoal, selectCreatedGoal } from "./_utils/create-goal-records";
import { findActiveGoalId, loadGoalViews } from "./_utils/goal-view";
import { splitDailyBudget } from "./daily-budget";
import { type GoalCreateInput, type GoalDraft, type GoalView } from "./goal-contract";

/**
 * Why one goal wasn't created: the plan's goal limits, too many requests at once, or a guest asked
 * to create an account.
 */
export type GoalRefusal = { decision: RefusedUsage; index: number };

export type GoalCreateResult =
  | { goals: GoalView[]; refused: GoalRefusal[]; status: "created" }
  | { refused: GoalRefusal[]; status: "refused" }
  | { status: "invalidReference" }
  | { status: "unauthorized" };

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

/**
 * The language each exam the exam goals point at tests, by blueprint, as its notice says ("en" for
 * IELTS or PTE Academic). Exams whose notice names none aren't in it.
 */
async function loadTestedLanguages(goals: GoalDraft[]): Promise<Map<string, string>> {
  const ids = [
    ...new Set(goals.flatMap((goal) => (goal.kind === "exam" && goal.examBlueprintId) || [])),
  ];

  if (ids.length === 0) {
    return new Map();
  }

  const blueprints = await prisma.examBlueprint.findMany({
    select: { id: true, structure: true },
    where: { id: { in: ids } },
  });

  return new Map(
    blueprints.flatMap((blueprint) => {
      const language = readTestedLanguage(blueprint.structure);
      return language ? [[blueprint.id, language] as const] : [];
    }),
  );
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
 * Refuses a new goal's date outside the supported range (see `assertTargetDates`), counted from the
 * learner's own today, before anything is claimed or created.
 */
function assertNewGoalDates(input: GoalCreateInput): void {
  const timeZone = getAnswerTimeZone({ goal: null, timeZone: input.timeZone });

  assertTargetDates({
    latestOnly: false,
    targets: input.goals.map((goal, index) => ({
      path: ["goals", index, "targetDate"],
      targetDate: goal.targetDate,
    })),
    today: toIsoDate(getDateInTimeZone({ date: new Date(), timeZone })),
  });
}

/**
 * Creates the learner's goals from onboarding with an empty plan the planner fills. Each goal is
 * claimed against the learner's plan first (free learners follow one active goal), and the ones
 * allowed are created even when a later one isn't. The first new goal becomes the one the tabs
 * show: it's the main goal, whose session comes first. A goal that replaces one of the learner's
 * (`replacesGoalId`: a language goal moving to its exam, a finished level going on to the next)
 * isn't another goal, so it claims nothing; its callers let a goal be replaced only once, so a
 * replacement can't repeat into unlimited new goals.
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
  const replacing = await isOwnGoal({ goalId: replacesGoalId, userId });

  // Only an owned replacement carries an accepted date; every other request creates a new goal.
  if (!replacing) {
    assertNewGoalDates(input);
  }

  if (!(await hasValidReferences({ goals: input.goals, userId }))) {
    return { status: "invalidReference" };
  }

  const minutes = assignDailyMinutes(input);

  const testedLanguages = await loadTestedLanguages(input.goals);

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
        testedLanguage:
          (draft.kind === "exam" && testedLanguages.get(draft.examBlueprintId ?? "")) || null,
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

  await selectCreatedGoal({ activeGoalId, userId });

  revalidateCacheTags([getGoalsCacheTag(userId), getLearningProfileCacheTag(userId)]);

  const rows = await prisma.goal.findMany({ where: { id: { in: results.ids } } });
  const goals = results.ids.flatMap((id) => rows.find((goal) => goal.id === id) ?? []);

  return {
    goals: await loadGoalViews({ activeGoalId, goals }),
    refused: results.refused,
    status: "created",
  };
}
