import "server-only";
import { type Goal, type StudySession, type StudySessionBlock } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { withoutLockedPhaseChallenges } from "../../../checkpoints/_utils/phase-challenge-access";
import { getCarryOverEnd, pickCurrentDay } from "../../../sessions/_utils/current-session";
import { getNextBlockId, getSessionBar } from "../../../sessions/_utils/session-view";
import { readBlockPayload } from "../../../sessions/block-payload";
import { countMissions } from "../../../sessions/missions";
import { getDayMissions } from "../../../sessions/missions/get-day-missions";
import { type LearnerSummaryToday } from "../learner-summary-contract";

export type SavedSession = StudySession & { blocks: StudySessionBlock[] };

/**
 * The active goal's saved day among the learner's recent sessions: today's, or the day before's
 * while they're still in it. Never one the summary builds.
 */
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

/**
 * The saved day as the sidebar and the palette show it: its blocks left and the one up next (its
 * lesson's title, when it has one, and its minutes). Free language plans skip their locked calls.
 * An explanation, or a goal that isn't followed now, has none.
 */
function getSummaryToday({
  day,
  goal,
  phaseChallengesRequired,
}: {
  day: SavedSession | null;
  goal: Goal;
  phaseChallengesRequired: boolean;
}): LearnerSummaryToday | null {
  if (!day || goal.kind === "explain" || goal.status !== "active") {
    return null;
  }

  const blocks = withoutLockedPhaseChallenges({ blocks: day.blocks, phaseChallengesRequired });
  const bar = getSessionBar(blocks);
  const nextId = getNextBlockId(blocks);
  const next = blocks.find((block) => block.id === nextId);
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

/**
 * The day's missions as the buddy's tab rings them, through the one mission reader Today and the
 * buddy use. The ring only counts them, so the blocks' saved minutes stand in for their display.
 */
async function countDayMissions({
  day,
  goal,
  now,
  readyMistakesOn,
  timeZone,
}: {
  day: SavedSession | null;
  goal: Goal;
  now: Date;
  readyMistakesOn?: (localDate: Date) => Promise<number>;
  timeZone: string;
}): Promise<{ done: number; total: number } | null> {
  if (!day) {
    return null;
  }

  const missions = await getDayMissions({
    displayBlocks: day.blocks,
    readyMistakesOn,
    session: { ...day, goal },
    through: now,
    timeZone,
  });

  return countMissions(missions);
}

/**
 * What the active goal's saved day gives the summary: today's queue, the missions ring, when a day
 * carried over from the night before stops being the learner's (`carriedUntil`), and the day they
 * describe (`dayDate`: that carried day's, else today's).
 */
export async function loadActiveGoalDay({
  goal,
  localDate,
  now,
  phaseChallengesRequired,
  readyMistakesOn,
  sessions,
  timeZone,
}: {
  goal: Goal | null;
  localDate: Date;
  now: Date;
  phaseChallengesRequired: boolean;
  /** The goal's mistakes ready to practice on a day, which a day saved without missions shares. */
  readyMistakesOn?: (localDate: Date) => Promise<number>;
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

  return {
    carriedUntil: carried ? getCarryOverEnd(day) : null,
    dayDate: day?.localDate ?? localDate,
    missions: await countDayMissions({ day, goal, now, readyMistakesOn, timeZone }),
    today: getSummaryToday({ day, goal, phaseChallengesRequired }),
  };
}
