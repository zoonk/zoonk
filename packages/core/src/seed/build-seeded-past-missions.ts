import "server-only";
import { prisma } from "@zoonk/db";
import { getLearnerTier } from "../lookahead/learner-lookahead";
import { getGoalDayMinutes } from "../sessions/_utils/day-minutes";
import { readBlockPayload } from "../sessions/block-payload";
import { blockCandidates } from "../sessions/missions/block-candidates";
import { type DayMissionFacts } from "../sessions/missions/day-facts";
import { pickMissions } from "../sessions/missions/pick-missions";

/** Past days use the same mission picker, with the work the persona's history says it studied. */
export async function buildSeededPastMissions(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  const tier = await getLearnerTier(goal.userId);

  const sessions = await prisma.studySession.findMany({
    include: { blocks: { orderBy: { position: "asc" } } },
    orderBy: { localDate: "asc" },
    where: { goalId, status: "completed" },
  });

  await Promise.all(
    sessions.map(async (session) => {
      const blocks = session.blocks.map((block) => ({
        ...block,
        estimatedMinutes: block.estimatedMinutes ?? 0,
        payload: readBlockPayload(block),
      }));

      const candidates = blockCandidates({ blocks, plannedMinutes: session.plannedMinutes, tier });
      const dailyMinutes = getGoalDayMinutes({ date: session.localDate, goal, planSettings: null });

      const facts: DayMissionFacts = {
        available: blocks.length > 0 && dailyMinutes > 0,
        blocks,
        candidates,
        dailyMinutes,
        firstSteps: null,
        localDate: session.localDate,
        oldestReadyMistakeAt: null,
        patternExpiresTomorrow: false,
        plannedMinutes: session.plannedMinutes,
        readyMistakeCount: 0,
        recentPicks: [],
      };

      await prisma.studySession.update({
        data: { missions: { picks: pickMissions(facts), version: 1 } },
        where: { id: session.id },
      });
    }),
  );
}
