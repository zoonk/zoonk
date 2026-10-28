import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import {
  loadGoalListeningSkillIds,
  loadLearnerListeningSkillIds,
} from "../exams/listening/listening-skills";
import { getSkillOwners } from "../learner/_utils/goal-skill-graph";
import { getStartOfLocalDay } from "../learner/_utils/local-time";
import { readGoalPlan } from "../learner/_utils/read-goal-plan";
import { readSavedPlan } from "../learner/facts/saved-plan";
import { getGoalField } from "../library/items/item-field";
import { type MistakeAvailability } from "./contract";
import { filterMistakesWithPracticeMaterial } from "./mistake-practice-eligibility";

/** Fixing requires recall on a later local day, never repeating a just-shown answer. */
export function getMistakePracticeBefore({
  localDate,
  timeZone,
}: {
  localDate: Date;
  timeZone: string;
}): Date {
  return getStartOfLocalDay({ localDate, timeZone });
}

function isMistakePracticeAvailable({
  createdAt,
  startOfToday,
  status,
}: {
  createdAt: Date;
  startOfToday: Date;
  status: "fixed" | "open";
}): boolean {
  return status === "open" && createdAt.getTime() < startOfToday.getTime();
}

type MistakeScopeInput = {
  /** The known goal's exam blueprint when the caller already read it (a GET), so it isn't again. */
  blueprint?: ExamBlueprint | null;
  /** The goal's row when the caller already read it (the learner summary), so it isn't again. */
  goal?: Goal | null;
  goalId?: string | null;
  skillIds?: readonly string[] | null;
  userId: string;
};

type AvailabilityInput = MistakeScopeInput & { localDate: Date; timeZone: string };

async function loadGoalScope({
  blueprint,
  goal: known,
  goalId,
  userId,
}: {
  blueprint?: ExamBlueprint | null;
  goal?: Goal | null;
  goalId: string;
  userId: string;
}) {
  const isKnown = known?.id === goalId;

  const [plan, saved, goal] = await Promise.all([
    readGoalPlan(goalId),
    readSavedPlan(userId, goalId),
    isKnown ? known : prisma.goal.findUnique({ where: { id: goalId } }),
  ]);

  const listeningSkillIds = goal
    ? await loadGoalListeningSkillIds({
        blueprint: isKnown ? blueprint : undefined,
        goal,
        graph: saved?.graph ?? null,
      })
    : new Set<string>();

  return { goal, listeningSkillIds, ownerOf: getSkillOwners(plan.skills) };
}

/** Caller must authorize the learner and scoped goal first. */
async function loadPracticeEligibleMistakes({
  blueprint,
  goal: knownGoal,
  goalId,
  skillIds,
  userId,
}: MistakeScopeInput) {
  const scope = goalId ? await loadGoalScope({ blueprint, goal: knownGoal, goalId, userId }) : null;
  const ownerOf = scope?.ownerOf ?? new Map<string, string>();
  const scopedSkillIds = skillIds ?? (goalId ? [...ownerOf.keys()] : null);

  const where = {
    status: "open" as const,
    userId,
    ...(scopedSkillIds ? { skillId: { in: [...scopedSkillIds] } } : {}),
  };

  const [mistakes, listeningSkillIds] = await Promise.all([
    prisma.mistake.findMany({ omit: { snapshot: true }, where }),
    scope ? scope.listeningSkillIds : loadLearnerListeningSkillIds(userId),
  ]);

  const goal = scope?.goal ?? null;

  return filterMistakesWithPracticeMaterial({
    examBlueprintId: goal?.examBlueprintId ?? null,
    field: getGoalField(goal?.details),
    listeningSkillIds,
    mistakes,
    ownerOf,
  });
}

type EligibleMistake = Awaited<ReturnType<typeof loadPracticeEligibleMistakes>>[number];

function findReadyIds({
  eligible,
  localDate,
  timeZone,
}: {
  eligible: readonly EligibleMistake[];
  localDate: Date;
  timeZone: string;
}): Set<string> {
  const startOfToday = getMistakePracticeBefore({ localDate, timeZone });

  return new Set(
    eligible
      .filter((mistake) => isMistakePracticeAvailable({ ...mistake, startOfToday }))
      .map((mistake) => mistake.id),
  );
}

/** Caller must authorize the learner and scoped goal first. */
export async function loadMistakePracticeAvailability(
  input: AvailabilityInput,
): Promise<{
  availability: MistakeAvailability;
  readyIds: ReadonlySet<string>;
  tomorrowIds: ReadonlySet<string>;
}> {
  const eligible = await loadPracticeEligibleMistakes(input);
  const readyIds = findReadyIds({ eligible, ...input });

  const tomorrowIds = new Set(
    eligible.filter((mistake) => !readyIds.has(mistake.id)).map((mistake) => mistake.id),
  );

  return {
    availability: { ready: readyIds.size, tomorrow: tomorrowIds.size },
    readyIds,
    tomorrowIds,
  };
}

export async function countReadyMistakes({
  timeZone,
  today,
  ...scope
}: MistakeScopeInput & { timeZone: string; today: Date }): Promise<number> {
  const candidate = await prisma.mistake.findFirst({
    select: { id: true },
    where: {
      createdAt: { lt: getMistakePracticeBefore({ localDate: today, timeZone }) },
      status: "open",
      userId: scope.userId,
    },
  });

  if (!candidate) {
    return 0;
  }

  const eligible = await loadPracticeEligibleMistakes(scope);
  return findReadyIds({ eligible, localDate: today, timeZone }).size;
}
