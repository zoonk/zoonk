import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { trackOnboardingProgress } from "../analytics/track-onboarding-progress";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import {
  getAllowanceCacheTag,
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getLearningProfileCacheTag,
} from "../cache/tags";
import { getEntitlementViewer } from "../entitlements/_utils/entitlement-viewer";
import { type RefusedUsage, isRefusedUsage } from "../entitlements/contract";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { libraryRowsVisibleTo } from "../library/_utils/library-visibility";
import { readTestedLanguage } from "../library/exams/blueprint-language";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { assertTargetDates, withPlannableDate } from "../plans/target-date-range";
import {
  type CardPlace,
  type CourseGoalOrigin,
  createGoal,
  selectCreatedGoal,
} from "./_utils/create-goal-records";
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

async function selectNewGoals({
  input,
  mainId,
  userId,
}: {
  input: GoalCreateInput;
  mainId: string;
  userId: string;
}): Promise<string> {
  const activeGoalId = await chooseActiveGoalId({ input, mainId, userId });

  await selectCreatedGoal({ activeGoalId, userId });

  revalidateCacheTags([
    getAllowanceCacheTag(userId),
    getGoalsCacheTag(userId),
    getLearningProfileCacheTag(userId),
    ...(input.pauseGoalId ? [getLearnerModelCacheTag(userId)] : []),
  ]);

  return activeGoalId;
}

function isCardGoal(goal: GoalDraft): boolean {
  const onboardingId = goal.details?.onboardingId;
  return typeof onboardingId === "string" && onboardingId !== "";
}

/**
 * A card's date can stop being ahead after the card was read (past midnight, or confirmed in
 * another zone than the draft's), so a goal from a card (`details.onboardingId`) takes its date as
 * the card reads it; a date no card gave is refused as sent.
 */
function readNewGoalDates(input: GoalCreateInput): GoalCreateInput {
  const timeZone = getAnswerTimeZone({ goal: null, timeZone: input.timeZone });
  const today = toIsoDate(getDateInTimeZone({ date: new Date(), timeZone }));

  const goals = input.goals.map((goal) =>
    isCardGoal(goal) ? withPlannableDate({ draft: goal, today }) : goal,
  );

  assertTargetDates({
    latestOnly: false,
    targets: goals.map((goal, index) => ({
      path: ["goals", index, "targetDate"],
      targetDate: goal.targetDate,
    })),
    today,
  });

  return { ...input, goals };
}

/** `Goal.onboardingPlace` is a smallint. */
const MAX_CARD_PLACE = 32_767;

function isCardPlace(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= MAX_CARD_PLACE;
}

/**
 * "Looks right" sends a card's goals in its order, and a goal started later from the card's waiting
 * row names its place.
 */
function readCardPlace({
  draft,
  index,
}: {
  draft: GoalDraft;
  index: number;
}): CardPlace | undefined {
  const { onboardingId, onboardingPlace } = draft.details ?? {};

  if (typeof onboardingId !== "string" || !isUuid(onboardingId)) {
    return undefined;
  }

  return { draftId: onboardingId, place: isCardPlace(onboardingPlace) ? onboardingPlace : index };
}

type CourseGoalCreateResult = GoalCreateResult | { goalId: string; status: "existing" };

type CreatedGoals = {
  created: string[];
  existingId?: string;
  ids: string[];
  refused: GoalRefusal[];
};

export function createGoals(requested: GoalCreateInput): Promise<GoalCreateResult>;
export function createGoals(
  requested: GoalCreateInput,
  courseStart: CourseGoalOrigin,
): Promise<CourseGoalCreateResult>;
export async function createGoals(
  requested: GoalCreateInput,
  courseStart?: CourseGoalOrigin,
): Promise<CourseGoalCreateResult> {
  const viewer = await getEntitlementViewer();

  if (!viewer) {
    return { status: "unauthorized" };
  }

  const { userId } = viewer;
  const input = readNewGoalDates(requested);

  if (!(await hasValidReferences({ goals: input.goals, userId }))) {
    return { status: "invalidReference" };
  }

  const minutes = assignDailyMinutes(input);

  const testedLanguages = await loadTestedLanguages(input.goals);

  /** One at a time, so each claim counts the goals created before it. */
  const results = await input.goals.reduce<Promise<CreatedGoals>>(
    async (previous, draft, index) => {
      const state = await previous;

      if (state.existingId) {
        return state;
      }

      const id = crypto.randomUUID();

      const decision = await createGoal({
        card: readCardPlace({ draft, index }),
        courseStart,
        dailyMinutes: minutes[index] ?? input.dailyMinutes,
        draft,
        id,
        input,
        testedLanguage:
          (draft.kind === "exam" && testedLanguages.get(draft.examBlueprintId ?? "")) || null,
        userId,
        viewer,
      });

      if (decision.status === "existing") {
        return courseStart
          ? { ...state, existingId: decision.goalId }
          : { ...state, ids: [...state.ids, decision.goalId] };
      }

      if (decision.status === "allowed") {
        return { ...state, created: [...state.created, id], ids: [...state.ids, id] };
      }

      return isRefusedUsage(decision)
        ? { ...state, refused: [...state.refused, { decision, index }] }
        : state;
    },
    Promise.resolve({ created: [], ids: [], refused: [] }),
  );

  if (results.existingId) {
    return { goalId: results.existingId, status: "existing" };
  }

  const [mainId] = results.ids;

  if (!mainId) {
    return { refused: results.refused, status: "refused" };
  }

  // A confirm that only found goals made before leaves the goal the learner studies as it is.
  const activeGoalId =
    results.created.length > 0
      ? await selectNewGoals({ input, mainId, userId })
      : ((await findActiveGoalId(userId)) ?? mainId);

  const rows = await prisma.goal.findMany({ where: { id: { in: results.ids } } });
  const goals = results.ids.flatMap((id) => rows.find((goal) => goal.id === id) ?? []);

  goals
    .filter((goal) => results.created.includes(goal.id))
    .forEach((goal) =>
      trackOnboardingProgress({
        at: goal.createdAt.getTime(),
        goalId: goal.id,
        stage: "goal_created",
      }),
    );

  return {
    goals: await loadGoalViews({ activeGoalId, goals }),
    refused: results.refused,
    status: "created",
  };
}
