import "server-only";
import { type StudySessionBlock, type TransactionClient, prisma } from "@zoonk/db";
import { type FollowUp } from "../follow-ups/follow-up-contract";
import { oweFollowUps } from "../follow-ups/owe-follow-ups";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { awardMilestones } from "../milestones/award-milestones";
import { getBlockMilestoneAwards } from "./_utils/block-completion";
import { isCurrentSession } from "./_utils/current-session";
import { readFullMealReward } from "./_utils/session-snapshot";
import { settleSessionDay } from "./_utils/settle-session-day";
import { readBlockPayload } from "./block-payload";
import { type MissionCompletionSource } from "./missions/settle-missions";

type OwedDay = Extract<FollowUp, { kind: "settleSessionDay" }>["input"];

/**
 * Call in the transaction that finishes the block, with the settlement its request runs. That
 * request settles the day only after the block commits, so one that fails or ends in between would
 * leave the day unsettled.
 */
export function oweDaySettlement(
  tx: TransactionClient,
  {
    block,
    rewardMissions,
    source,
    timeZone,
    userId,
  }: {
    block: Pick<StudySessionBlock, "id" | "sessionId">;
    rewardMissions?: boolean;
    /** The activity that finished the block, as its own settlement names it. */
    source?: MissionCompletionSource;
    timeZone: string;
    userId: string;
  },
): Promise<void> {
  const input: OwedDay = {
    blockId: block.id,
    rewardMissions,
    sessionId: block.sessionId,
    source,
    timeZone,
  };

  return oweFollowUps({
    db: tx,
    followUps: [
      { input, kind: "settleSessionDay" },
      { input: { sessionId: block.sessionId, timeZone }, kind: "refreshStudyDay" },
    ],
    userId,
  });
}

type OwedSession = NonNullable<Awaited<ReturnType<typeof findOwedSession>>>;

function findOwedSession({ sessionId, userId }: { sessionId: string; userId: string }) {
  return prisma.studySession.findFirst({
    select: {
      blocks: { select: { completedAt: true, id: true, payload: true, startedAt: true } },
      endedAt: true,
      goal: { select: { timezone: true } },
      localDate: true,
      startSnapshot: true,
      startedAt: true,
      status: true,
    },
    where: { id: sessionId, userId },
  });
}

async function settleOpenDay({
  rewardMissions = true,
  session,
  timeZone,
  ...owed
}: OwedDay & { session: OwedSession; userId: string }) {
  const zone = getAnswerTimeZone({ goal: session.goal, timeZone });

  // As on a day's open, missions settle only while their day is current: later activity would
  // count toward them, and the full meal pays once for the day it's paid in.
  const current = isCurrentSession({ now: new Date(), session, timeZone: zone });

  const settled = await settleSessionDay({
    ...owed,
    rewardMissions: rewardMissions && current,
    timeZone: zone,
  });

  return settled.fullMealReward;
}

/** Internal, for the follow-up a finished block owes; usually its request already settled the day. */
export async function settleOwedSessionDay(owed: OwedDay & { userId: string }): Promise<void> {
  const session = await findOwedSession(owed);

  if (!session) {
    return;
  }

  // Completion settles the day's missions first, so a completed day owes only its milestones.
  const fullMealReward =
    session.status === "completed"
      ? readFullMealReward(session.startSnapshot)
      : await settleOpenDay({ ...owed, session });

  const block = session.blocks.find((row) => row.id === owed.blockId);
  const payload = block ? readBlockPayload(block) : null;
  const reward = payload?.milestoneReward;

  if (!reward && !fullMealReward) {
    return;
  }

  // The request awards these only after the day settles; recovery uses the evidence the block kept.
  await awardMilestones({
    ...(payload && reward ? getBlockMilestoneAwards({ payload, reward }) : { brainPower: null }),
    brainPowerRewards: fullMealReward ? [fullMealReward] : [],
    userId: owed.userId,
  });
}
