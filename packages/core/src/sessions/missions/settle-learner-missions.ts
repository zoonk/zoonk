import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { type BrainPowerReward } from "../../milestones/milestone-reward";
import { isCurrentSession } from "../_utils/current-session";
import { STUDY_SESSION_INCLUDE } from "../_utils/study-session-access";
import { type MissionCompletionSource, settleMissions } from "./settle-missions";

/** Internal: a committed learner activity can finish any goal's offered mission, without ending its session. */
export async function settleLearnerMissions({
  userId,
  timeZone,
  source,
}: {
  userId: string;
  timeZone: string;
  source?: MissionCompletionSource;
}): Promise<{ fullMealPaid: boolean; fullMealReward: BrainPowerReward | null }> {
  const now = new Date();
  const day = getDateInTimeZone({ date: now, timeZone });
  // Goal time zones may differ from the device. Load nearby date labels, then use each goal's clock.
  const sessions = await prisma.studySession.findMany({
    include: STUDY_SESSION_INCLUDE,
    orderBy: [{ localDate: "asc" }, { createdAt: "asc" }],
    where: {
      localDate: {
        gte: new Date(day.getTime() - MS_PER_DAY * 2),
        lte: new Date(day.getTime() + MS_PER_DAY),
      },
      userId,
    },
  });

  const current = sessions.filter((session) => {
    const zone = getAnswerTimeZone({
      goal: session.goal,
      timeZone: session.goal?.timezone ?? timeZone,
    });

    if (!isCurrentSession({ now, session, timeZone: zone })) {
      return false;
    }

    const today = getDateInTimeZone({ date: now, timeZone: zone });
    const sameGoal = sessions.filter((candidate) => candidate.goalId === session.goalId);

    const todaySession = sameGoal.find(
      (candidate) => candidate.localDate.getTime() === today.getTime(),
    );

    if (session.localDate.getTime() !== today.getTime()) {
      return !todaySession?.startedAt;
    }

    const carried = sameGoal.some(
      (candidate) =>
        candidate.localDate < today &&
        isCurrentSession({ now, session: candidate, timeZone: zone }),
    );

    return !carried || session.startedAt !== null;
  });

  const results = await Promise.all(
    current.map((session) =>
      settleMissions({
        sessionId: session.id,
        source,
        timeZone: session.goal?.timezone ?? timeZone,
        userId,
      }),
    ),
  );

  const paid = results.find((result) => result.fullMealPaid);
  return { fullMealPaid: paid !== undefined, fullMealReward: paid?.fullMealReward ?? null };
}
