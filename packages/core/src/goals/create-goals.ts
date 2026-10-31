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

export type GoalRefusal = { decision: RefusedUsage; index: number };

export type GoalCreateResult =
  | { goals: GoalView[]; refused: GoalRefusal[]; status: "created" }
  | { refused: GoalRefusal[]; status: "refused" }
  | { status: "invalidReference" }
  | { status: "unauthorized" };

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

async function isOwnGoal({ goalId, userId }: { goalId?: string; userId: string }) {
  return goalId ? (await prisma.goal.count({ where: { id: goalId, userId } })) > 0 : false;
}

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
 * A replacement (`replacesGoalId`) claims no slot, so callers must let a goal be replaced only
 * once.
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

      const limit = await createGoal({
        dailyMinutes: minutes[index] ?? input.dailyMinutes,
        draft,
        id,
        input,
        replacing,
        testedLanguage:
          (draft.kind === "exam" && testedLanguages.get(draft.examBlueprintId ?? "")) || null,
        userId,
      });

      if (limit) {
        return {
          ...state,
          refused: [
            ...state.refused,
            { decision: { limit, status: "limitReached" as const }, index },
          ],
        };
      }

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
