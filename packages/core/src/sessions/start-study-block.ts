import "server-only";
import { type StudySessionBlock, prisma } from "@zoonk/db";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { getDailyTimeLimitStatus } from "../minors/get-daily-time-limit";
import { captureSessionSnapshot } from "./_utils/capture-snapshot";
import { trackSessionStarted } from "./_utils/session-events";
import { getLearnerMode, recordSessionStart } from "./_utils/session-ledger";
import { type StudySessionRow, findOwnedStudyBlock } from "./_utils/study-session-access";
import { type StudySessionTimeZoneInput } from "./contract";

type StartedStudyBlock = Pick<
  StudySessionBlock,
  "id" | "kind" | "lessonId" | "startedAt" | "status"
>;

export type StartStudyBlockResult =
  | { block: StartedStudyBlock; status: "ready" }
  | { status: "blockFinished" }
  | { status: "dailyLimitReached" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/**
 * The first block to start opens the session: it records where the learner stands (so the end
 * can say what changed), writes the session's ledger row and sends "Session Started". Later
 * starts leave all three alone.
 */
async function openSession({
  now,
  session,
  timeZone,
  userId,
}: {
  now: Date;
  session: StudySessionRow;
  timeZone: string;
  userId: string;
}) {
  if (session.startedAt) {
    await prisma.studySession.updateMany({
      data: { status: "active" },
      where: { id: session.id, status: { not: "active" } },
    });

    return;
  }

  const [snapshot, mode] = await Promise.all([
    captureSessionSnapshot({ goalId: session.goalId, now, timeZone, userId }),
    getLearnerMode(userId),
  ]);

  const opened = await prisma.$transaction(async (tx) => {
    const { count } = await tx.studySession.updateMany({
      data: { startSnapshot: snapshot, startedAt: now, status: "active" },
      where: { id: session.id, startedAt: null },
    });

    if (count === 1) {
      await recordSessionStart(tx, { mode, now, session, timeZone });
    }

    return count === 1;
  });

  if (opened) {
    trackSessionStarted(session);
  }
}

/**
 * Starts (or resumes) one block of the learner's session. A guardian's daily limit is checked
 * before anything new starts; a finished block can't start again.
 */
export async function startStudyBlock({
  blockId,
  input,
  sessionId,
}: {
  blockId: string;
  input: StudySessionTimeZoneInput;
  sessionId: string;
}): Promise<StartStudyBlockResult> {
  const owned = await findOwnedStudyBlock({ blockId, sessionId });

  if (owned.status !== "ready") {
    return owned;
  }

  const { block, session, userId } = owned;

  if (block.status === "completed" || block.status === "skipped") {
    return { status: "blockFinished" };
  }

  const limit = await getDailyTimeLimitStatus();

  if (block.status === "pending" && limit?.reached) {
    return { status: "dailyLimitReached" };
  }

  const now = new Date();
  const timeZone = getAnswerTimeZone({ goal: session.goal, timeZone: input.timeZone });

  await openSession({ now, session, timeZone, userId });

  const started = await prisma.studySessionBlock.update({
    data: { startedAt: block.startedAt ?? now, status: "active" },
    select: { id: true, kind: true, lessonId: true, startedAt: true, status: true },
    where: { id: block.id },
  });

  return { block: started, status: "ready" };
}
