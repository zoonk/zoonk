import { loadSessionBosses } from "../../checkpoints/_utils/load-boss";
import { type PlannedCheckpoint } from "../session-builder";

type DayAccess = { trialEnded: boolean };
type DayBosses = Awaited<ReturnType<typeof loadSessionBosses>>;

/**
 * Today's bosses (see `loadSessionBosses`): none once a free exam plan's first days are over, when
 * the session plays no challenge (see `buildSessionBlocks`). Loaded all the same, they held back
 * their questions from the day's quick review and practice: a free learner's known topic went
 * unasked.
 */
export async function loadDayBosses({
  access,
  ...input
}: Parameters<typeof loadSessionBosses>[0] & { access: DayAccess }): Promise<DayBosses> {
  return access.trialEnded ? { checkpoints: [], reinforcement: [] } : loadSessionBosses(input);
}

/**
 * The day's challenges: its bosses first, then its mock, which the plan funded beside them; a
 * weekly challenge waits for a day without a boss. None once a free exam plan's first days are over
 * (see `loadDayBosses`): its weekly challenge would hold back its questions the same way.
 */
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
