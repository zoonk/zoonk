import { loadSessionBosses } from "../../checkpoints/_utils/load-boss";
import { type PlannedCheckpoint } from "../session-builder";
import { type loadDayPlan } from "./day-plan";
import { type SessionDayContext } from "./session-placement";

type DayAccess = { trialEnded: boolean };
type DayBosses = Awaited<ReturnType<typeof loadSessionBosses>>;

/** Locked challenges must not reserve questions away from the free learner's review and practice. */
export async function loadDayBosses({
  access,
  context: { goal, localDate, readSubscription, userId },
  plan,
}: {
  access: DayAccess;
  context: SessionDayContext;
  plan: Awaited<ReturnType<typeof loadDayPlan>>;
}): Promise<DayBosses> {
  if (access.trialEnded) {
    return { checkpoints: [], reinforcement: [] };
  }

  return loadSessionBosses({
    examBlueprintId: goal.examBlueprintId,
    goal,
    graphSkills: plan.graph.skills,
    itemSkillIds: plan.itemSkillIds,
    items: plan.items,
    listeningSkillIds: plan.listeningSkillIds,
    readSubscription,
    skills: plan.skills,
    today: localDate,
    userId,
  });
}

/** Mocks may share a funded day with bosses; weekly mixed challenges wait for a boss-free day. */
export function listDayCheckpoints({
  access,
  boss,
  weekly,
}: {
  access: DayAccess;
  boss: Pick<DayBosses, "checkpoints">;
  weekly: { checkpoint: PlannedCheckpoint | null };
}): PlannedCheckpoint[] {
  const { checkpoint: week } = weekly;

  if (access.trialEnded) {
    return [];
  }

  return week && (week.mock || boss.checkpoints.length === 0)
    ? [...boss.checkpoints, week]
    : [...boss.checkpoints];
}
