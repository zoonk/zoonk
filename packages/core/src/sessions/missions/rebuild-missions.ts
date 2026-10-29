import "server-only";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { countUsage } from "../../entitlements/_utils/usage-counts";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { getLearnerTier } from "../../lookahead/learner-lookahead";
import { LEARN_KINDS } from "../../plans/planner/plan-item-rules";
import { type loadDayPlan } from "../_utils/day-plan";
import { type StudySessionRow } from "../_utils/study-session-access";
import { type Mission } from "../missions";
import { type PlannedBlock } from "../session-builder";
import { hasMissionAllowance } from "./candidate-allowance";
import { type MissionPick, readMissionDocument } from "./catalog";
import { type DayMissionFacts, loadDayMissionFacts } from "./day-facts";
import { fitMission } from "./fit-mission";
import { getDayMissions } from "./get-day-missions";
import { getMissionBlocks } from "./mission-blocks";
import { pickMissions } from "./pick-missions";

const SECONDS_PER_MINUTE = 60;

/** Candidate facts load before queue locks; saved targets and progress are checked under the lock. */
export async function loadRebuildMissionFacts({
  blocks,
  dayPlan,
  goal,
  kept,
  session,
  timeZone,
  unchanged,
}: {
  blocks: readonly PlannedBlock[];
  dayPlan: Awaited<ReturnType<typeof loadDayPlan>>;
  goal: Goal;
  kept: number;
  session: StudySessionRow;
  timeZone: string;
  unchanged: boolean;
}): Promise<DayMissionFacts | null> {
  if (kept > 0 || session.startedAt !== null || unchanged) {
    return null;
  }

  return loadDayMissionFacts({
    blocks,
    dayPlan,
    goal,
    localDate: session.localDate,
    plannedMinutes: blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0),
    timeZone,
    userId: session.userId,
  });
}

async function canFinishChapter({
  client,
  pick,
  session,
}: {
  client: TransactionClient;
  pick: MissionPick;
  session: StudySessionRow;
}): Promise<boolean> {
  if (!pick.anchor.chapterId || !session.goalId) {
    return false;
  }

  const remaining = await client.planItem.findMany({
    where: {
      chapterId: pick.anchor.chapterId,
      kind: { in: [...LEARN_KINDS] },
      plan: { goalId: session.goalId },
      status: "todo",
    },
  });

  return (
    remaining.length > 0 &&
    remaining.every(
      (item) =>
        item.kind === "lesson" &&
        (pick.anchor.planItemIds?.includes(item.id) ||
          (item.lessonId !== null && pick.anchor.lessonIds?.includes(item.lessonId))),
    )
  );
}

async function canCall({
  client,
  pick,
  session,
}: {
  client: TransactionClient;
  pick: MissionPick;
  session: StudySessionRow;
}): Promise<boolean> {
  if (session.goal?.kind !== "language" || !session.goal.targetLanguage || !pick.anchor.chapterId) {
    return false;
  }

  const now = new Date();

  const [chapter, counts, tier] = await Promise.all([
    client.chapter.findFirst({
      where: {
        ...libraryRowsVisibleTo(session.userId),
        id: pick.anchor.chapterId,
        targetLanguage: session.goal.targetLanguage,
      },
    }),
    countUsage({ client, kind: "conversation", now, userId: session.userId }),
    getLearnerTier(session.userId),
  ]);

  return (
    Boolean(chapter) &&
    hasMissionAllowance({ counts, kind: "conversation", now, seconds: SECONDS_PER_MINUTE, tier })
  );
}

async function isEligible({
  client,
  facts,
  pick,
  session,
}: {
  client: TransactionClient;
  facts: DayMissionFacts;
  pick: MissionPick;
  session: StudySessionRow;
}): Promise<boolean> {
  if (!facts.available) {
    return false;
  }

  const candidate = facts.candidates.find(
    (entry) =>
      entry.kind === pick.kind &&
      (!pick.anchor.patternId || entry.anchor.patternId === pick.anchor.patternId),
  );

  if (pick.kind === "call") {
    return canCall({ client, pick, session });
  }

  if (!candidate && pick.kind !== "finishChapter" && pick.kind !== "weakSpot") {
    return false;
  }

  if (pick.kind === "fixMistake" && facts.readyMistakeCount < pick.total) {
    return false;
  }

  const blockAnchor =
    pick.anchor.blockKind ||
    pick.anchor.planItemId ||
    pick.anchor.planItemIds ||
    pick.anchor.lessonIds;

  const blocks = getMissionBlocks({ blocks: facts.blocks, pick }).filter(
    (block) => !pick.anchor.blockKind || block.kind === pick.anchor.blockKind,
  );

  if (blockAnchor && blocks.length < pick.total) {
    return false;
  }

  return pick.kind !== "finishChapter" || canFinishChapter({ client, pick, session });
}

function remainingPick({
  current,
  pick,
}: {
  current: readonly Mission[];
  pick: MissionPick;
}): MissionPick {
  const done = current.find((mission) => mission.kind === pick.kind)?.done ?? 0;
  return { ...pick, total: Math.max(1, pick.total - done) };
}

/** A changed queue keeps eligible targets; an entirely impossible set gets a fresh fitting offer. */
export async function rebuildMissions({
  client,
  facts,
  session,
  timeZone,
}: {
  client: TransactionClient;
  facts: DayMissionFacts | null;
  session: StudySessionRow;
  timeZone: string;
}) {
  if (!facts || session.startedAt || session.fullMealAt) {
    return null;
  }

  const current = await getDayMissions({ client, session, timeZone });

  if (current.some((mission) => mission.status === "done")) {
    return null;
  }

  const document = readMissionDocument(session.missions);

  const eligible = await Promise.all(
    (document?.picks ?? []).map(async (pick) =>
      (await isEligible({ client, facts, pick: remainingPick({ current, pick }), session }))
        ? pick
        : null,
    ),
  );

  const picks = eligible.reduce<MissionPick[]>((chosen, pick) => {
    if (!pick) {
      return chosen;
    }

    const remaining = remainingPick({ current, pick });

    const fitted = fitMission({
      chosen: chosen.map((entry) => remainingPick({ current, pick: entry })),
      facts,
      pick: remaining,
    });

    if (fitted?.total === remaining.total) {
      chosen.push(pick);
    }

    return chosen;
  }, []);

  return { picks: picks.length > 0 ? picks : pickMissions(facts), version: 1 };
}
