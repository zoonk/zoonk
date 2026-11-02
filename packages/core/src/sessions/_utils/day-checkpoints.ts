import { loadSessionBosses } from "../../checkpoints/_utils/load-boss";
import { type PlannedCheckpoint } from "../session-builder";

type DayAccess = { trialEnded: boolean };
type DayBosses = Awaited<ReturnType<typeof loadSessionBosses>>;

/** Locked challenges must not reserve questions away from the free learner's review and practice. */
export async function loadDayBosses({
  access,
  ...input
}: Parameters<typeof loadSessionBosses>[0] & { access: DayAccess }): Promise<DayBosses> {
  return access.trialEnded ? { checkpoints: [], reinforcement: [] } : loadSessionBosses(input);
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
