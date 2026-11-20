import { type ChallengeReachItem } from "../../checkpoints/_utils/challenge-reach";
import { loadSessionBosses } from "../../checkpoints/_utils/load-boss";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { type PlannedCheckpoint } from "../session-builder";
import { type loadDayPlan } from "./day-plan";
import { getLeadingChallenges } from "./day-stretch";
import { type SessionDayContext } from "./session-placement";

type DayBosses = Awaited<ReturnType<typeof loadSessionBosses>>;

/** Locked challenges must not reserve questions away from the free learner's review and practice. */
export async function loadDayBosses({
  ahead,
  context: { goal, localDate, readSubscription, userId },
  plan,
}: {
  ahead: ReadonlySet<string>;
  context: SessionDayContext;
  plan: Awaited<ReturnType<typeof loadDayPlan>>;
}): Promise<DayBosses> {
  return loadSessionBosses({
    ahead,
    examBlueprintId: goal.examBlueprintId,
    goal,
    graphSkills: plan.graph.skills,
    itemSkillIds: plan.itemSkillIds,
    items: plan.items,
    listeningSkillIds: plan.listeningSkillIds,
    paceFactor: parsePlanSettings(plan.settings).pace?.factor,
    phases: plan.phases,
    readSubscription,
    skills: plan.skills,
    today: localDate,
    userId,
  });
}

/** Mocks may share a funded day with bosses; weekly mixed challenges wait for a boss-free day. */
export function listDayCheckpoints({
  boss,
  items = [],
  weekly,
}: {
  boss: Pick<DayBosses, "checkpoints">;
  items?: readonly ChallengeReachItem[];
  weekly: { checkpoint: PlannedCheckpoint | null };
}): PlannedCheckpoint[] {
  const { checkpoint: week } = weekly;

  return week &&
    (week.mock || getLeadingChallenges({ checkpoints: boss.checkpoints, items }).length === 0)
    ? [...boss.checkpoints, week]
    : [...boss.checkpoints];
}
