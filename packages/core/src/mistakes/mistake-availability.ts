import "server-only";
import { prisma } from "@zoonk/db";
import {
  loadLearnerListeningSkillIds,
  loadListeningSkillIds,
} from "../exams/listening/listening-skills";
import { getSkillOwners, loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { getStartOfLocalDay } from "../learner/_utils/local-time";
import { getGoalField } from "../library/items/item-field";
import { type MistakeAvailability } from "./contract";
import { filterMistakesWithPracticeMaterial } from "./mistake-practice-eligibility";

/** A mistake is fixed by recall on a later local day, rather than repeating the answer just shown. */
export function getMistakePracticeBefore({
  localDate,
  timeZone,
}: {
  localDate: Date;
  timeZone: string;
}): Date {
  return getStartOfLocalDay({ localDate, timeZone });
}

/** The notebook and the day's fix mission use this same boundary. */
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

type AvailabilityInput = {
  goalId?: string | null;
  localDate: Date;
  skillIds?: readonly string[] | null;
  timeZone: string;
  userId: string;
};

/** Internal: the caller has resolved the learner and owns the goal, when scoped. */
export async function loadMistakePracticeAvailability({
  goalId,
  localDate,
  skillIds,
  timeZone,
  userId,
}: AvailabilityInput): Promise<{
  availability: MistakeAvailability;
  readyIds: ReadonlySet<string>;
  tomorrowIds: ReadonlySet<string>;
}> {
  const plan = goalId ? await loadGoalPlan(goalId) : null;
  const ownerOf = getSkillOwners(plan?.skills ?? []);
  const scopedSkillIds = skillIds ?? (goalId ? [...ownerOf.keys()] : null);
  const startOfToday = getMistakePracticeBefore({ localDate, timeZone });

  const where = {
    status: "open" as const,
    userId,
    ...(scopedSkillIds ? { skillId: { in: [...scopedSkillIds] } } : {}),
  };

  const [mistakes, goal, listeningSkillIds] = await Promise.all([
    prisma.mistake.findMany({ omit: { snapshot: true }, where }),
    goalId ? prisma.goal.findUnique({ where: { id: goalId } }) : null,
    goalId ? loadListeningSkillIds(goalId) : loadLearnerListeningSkillIds(userId),
  ]);

  const eligible = await filterMistakesWithPracticeMaterial({
    examBlueprintId: goal?.examBlueprintId ?? null,
    field: getGoalField(goal?.details),
    listeningSkillIds,
    mistakes,
    ownerOf,
  });

  const readyIds = new Set(
    eligible
      .filter((mistake) => isMistakePracticeAvailable({ ...mistake, startOfToday }))
      .map((mistake) => mistake.id),
  );

  const tomorrowIds = new Set(
    eligible.filter((mistake) => !readyIds.has(mistake.id)).map((mistake) => mistake.id),
  );

  return {
    availability: { ready: readyIds.size, tomorrow: tomorrowIds.size },
    readyIds,
    tomorrowIds,
  };
}

/** The same actionable notebook mistakes feed the fix mission, with or without scheduled drills. */
export async function loadMistakeAvailability(
  input: AvailabilityInput,
): Promise<MistakeAvailability> {
  const result = await loadMistakePracticeAvailability(input);
  return result.availability;
}
