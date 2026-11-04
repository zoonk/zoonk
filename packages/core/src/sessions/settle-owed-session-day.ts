import "server-only";
import { type StudySessionBlock, type TransactionClient, prisma } from "@zoonk/db";
import { type FollowUp } from "../follow-ups/follow-up-contract";
import { oweFollowUps } from "../follow-ups/owe-follow-ups";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { settleSessionDay } from "./_utils/settle-session-day";
import { type MissionCompletionSource } from "./missions/settle-missions";

type OwedDay = Extract<FollowUp, { kind: "settleSessionDay" }>["input"];

/**
 * Call in the transaction that finishes the block. Its request settles the day only after that
 * commits, so a request that fails or ends in between would leave the day unsettled.
 */
export function oweDaySettlement(
  tx: TransactionClient,
  {
    block,
    source,
    timeZone,
    userId,
  }: {
    block: Pick<StudySessionBlock, "id" | "sessionId">;
    /** The activity that finished the block, as its own settlement names it. */
    source?: MissionCompletionSource;
    timeZone: string;
    userId: string;
  },
): Promise<void> {
  const input: OwedDay = { blockId: block.id, sessionId: block.sessionId, source, timeZone };
  return oweFollowUps({ db: tx, followUps: [{ input, kind: "settleSessionDay" }], userId });
}

/** Internal, for the follow-up a finished block owes; usually its request already settled the day. */
export async function settleOwedSessionDay({
  blockId,
  sessionId,
  source,
  timeZone,
  userId,
}: OwedDay & { userId: string }): Promise<void> {
  const session = await prisma.studySession.findFirst({
    select: { goal: { select: { timezone: true } }, status: true },
    where: { id: sessionId, userId },
  });

  // Completion settles the day's missions first, so a completed day owes nothing more.
  if (!session || session.status === "completed") {
    return;
  }

  await settleSessionDay({
    blockId,
    sessionId,
    source,
    timeZone: getAnswerTimeZone({ goal: session.goal, timeZone }),
    userId,
  });
}
