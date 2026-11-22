import "server-only";
import { type Goal, type StudySession, type StudySessionBlock } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { withoutLockedPhaseChallenges } from "../../../checkpoints/_utils/phase-challenge-access";
import { getCarryOverEnd, pickCurrentDay } from "../../../sessions/_utils/current-session";
import { type DayBlockInput } from "../../../sessions/_utils/day-block-view";
import { planEntitlementLapseRefill } from "../../../sessions/_utils/entitlement-lapse-refill";
import { loadPreparingMockPositions } from "../../../sessions/_utils/preparing-mock-blocks";
import { getSessionBar } from "../../../sessions/_utils/session-view";
import { readBlockPayload } from "../../../sessions/block-payload";
import { getNextBlock } from "../../../sessions/day-blocks";
import { countMissions } from "../../../sessions/missions";
import { getDayMissions } from "../../../sessions/missions/get-day-missions";
import { readDayMissionProgress } from "../../facts/day-mission-progress";
import { readActiveSubscription } from "../../facts/subscription";
import { type LearnerSummaryToday } from "../learner-summary-contract";

export type SavedSession = StudySession & { blocks: StudySessionBlock[] };

function findSavedDay({
  goal,
  localDate,
  now,
  sessions,
  timeZone,
}: {
  goal: Goal;
  localDate: Date;
  now: Date;
  sessions: readonly SavedSession[];
  timeZone: string;
}): SavedSession | null {
  const on = (date: Date) =>
    sessions.find(
      (session) => session.goalId === goal.id && session.localDate.getTime() === date.getTime(),
    ) ?? null;

  return pickCurrentDay({
    now,
    previous: on(new Date(localDate.getTime() - MS_PER_DAY)),
    timeZone,
    today: on(localDate),
  });
}

async function getSummaryToday({
  day,
  goal,
  phaseChallengesRequired,
  projected,
}: {
  projected?: readonly DayBlockInput[];
  day: SavedSession | null;
  goal: Goal;
  phaseChallengesRequired: boolean;
}): Promise<LearnerSummaryToday | null> {
  if (!day || goal.kind === "explain" || goal.status !== "active") {
    return null;
  }

  const blocks =
    projected ?? withoutLockedPhaseChallenges({ blocks: day.blocks, phaseChallengesRequired });

  const bar = getSessionBar(blocks);
  const preparing = await loadPreparingMockPositions({ blocks, goal, localDate: day.localDate });

  const next = getNextBlock(
    blocks.map((block) => ({ ...block, preparing: preparing.has(block.position) })),
  );

  const payload = next ? readBlockPayload(next) : null;

  return {
    blocksLeft: bar.total - bar.completed,
    next: next
      ? {
          minutes: next.estimatedMinutes ?? 0,
          sessionId: day.id,
          title: payload?.title ?? payload?.capsules[0]?.title ?? null,
        }
      : null,
  };
}

async function countDayMissions({
  day,
  goal,
  now,
  timeZone,
}: {
  day: SavedSession | null;
  goal: Goal;
  now: Date;
  timeZone: string;
}): Promise<{ done: number; total: number } | null> {
  if (!day) {
    return null;
  }

  const missions = await getDayMissions({
    displayBlocks: day.blocks,
    readProgress: readDayMissionProgress,
    session: { ...day, goal },
    through: now,
    timeZone,
  });

  return countMissions(missions);
}

/** dayDate may name yesterday's carried session; carriedUntil bounds how long it remains active. */
export async function loadActiveGoalDay({
  goal,
  localDate,
  now,
  phaseChallengesRequired,
  sessions,
  timeZone,
}: {
  goal: Goal | null;
  localDate: Date;
  now: Date;
  phaseChallengesRequired: boolean;
  sessions: readonly SavedSession[];
  timeZone: string;
}): Promise<{
  carriedUntil: Date | null;
  dayDate: Date;
  missions: { done: number; total: number } | null;
  today: LearnerSummaryToday | null;
}> {
  if (!goal) {
    return { carriedUntil: null, dayDate: localDate, missions: null, today: null };
  }

  const day = findSavedDay({ goal, localDate, now, sessions, timeZone });
  const carried = day && day.localDate.getTime() !== localDate.getTime();

  const refill = day
    ? await planEntitlementLapseRefill({
        goal,
        phaseChallengesRequired,
        readSubscription: readActiveSubscription,
        session: day,
        timeZone,
      })
    : null;

  const [missions, today] = await Promise.all([
    countDayMissions({ day, goal, now, timeZone }),
    getSummaryToday({ day, goal, phaseChallengesRequired, projected: refill?.blocks }),
  ]);

  return {
    carriedUntil: carried ? getCarryOverEnd(day) : null,
    dayDate: day?.localDate ?? localDate,
    missions,
    today,
  };
}
