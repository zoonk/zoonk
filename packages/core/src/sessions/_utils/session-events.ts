import "server-only";
import { type StudySessionBlock, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { after } from "next/server";
import { type AnalyticsEvent } from "../../analytics/events";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { getSessionBlockMinutes } from "../daily-goal";
import { getGoalDayMinutes } from "./day-minutes";
import { getSessionBar } from "./session-view";
import { type StudySessionRow } from "./study-session-access";

type SessionRef = Pick<StudySessionRow, "goalId" | "id" | "userId">;

/**
 * Session outcomes go out from the server after the response, with the learner's mode and goal
 * read from the database, so ad blockers can't hide them and the learner never waits on PostHog.
 */
function trackSessionEvent({ event, session }: { event: AnalyticsEvent; session: SessionRef }) {
  after(() =>
    trackLearnerEvents({ events: [event], goalId: session.goalId, userId: session.userId }),
  );
}

/** "Session Started" when the session's first block starts; later starts resume it. */
export function trackSessionStarted(session: StudySessionRow): void {
  trackSessionEvent({
    event: {
      name: "Session Started",
      properties: {
        blocks: session.blocks.length,
        planned_minutes: session.plannedMinutes,
        session_id: session.id,
      },
    },
    session,
  });
}

/** "Block Completed" once, when the block was marked done. */
export function trackBlockCompleted({
  block,
  seconds,
  session,
}: {
  block: Pick<StudySessionBlock, "kind" | "position">;
  seconds: number;
  session: SessionRef;
}): void {
  trackSessionEvent({
    event: {
      name: "Block Completed",
      properties: {
        block_kind: block.kind,
        position: block.position,
        seconds,
        session_id: session.id,
      },
    },
    session,
  });
}

/** Whether the session's minutes reached what the goal's plan gives its day, as Today shows it. */
async function isDailyGoalMet({
  minutes,
  session,
}: {
  minutes: number;
  session: StudySessionRow;
}): Promise<boolean> {
  if (!session.goal) {
    return false;
  }

  const plan = await prisma.plan.findUnique({
    select: { settings: true },
    where: { goalId: session.goal.id },
  });

  const dailyGoal = getGoalDayMinutes({
    date: session.localDate,
    goal: session.goal,
    planSettings: plan?.settings,
  });

  return minutes >= dailyGoal;
}

/**
 * "Session Completed" once, when the session's last block finished or the learner stopped for
 * the day. `session` is the row as it ended, with its blocks' final states.
 */
export function trackSessionCompleted(session: StudySessionRow): void {
  const minutes = Math.round(getSessionBlockMinutes(session.blocks));

  // A failed plan lookup only loses the event, like a PostHog failure would.
  after(() =>
    safeAsync(async () => {
      const event: AnalyticsEvent = {
        name: "Session Completed",
        properties: {
          blocks_completed: getSessionBar(session.blocks).completed,
          daily_goal_met: await isDailyGoalMet({ minutes, session }),
          minutes,
          session_id: session.id,
        },
      };

      await trackLearnerEvents({ events: [event], goalId: session.goalId, userId: session.userId });
    }),
  );
}
