import "server-only";
import { type StudySessionBlock, prisma } from "@zoonk/db";
import { fillCheckpointQuestions } from "../checkpoints/_utils/fill-checkpoint-questions";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { captureSessionSnapshot } from "./_utils/capture-snapshot";
import { trackSessionStarted } from "./_utils/session-events";
import { recordSessionStart } from "./_utils/session-ledger";
import { type StudySessionRow, findOwnedStudyBlock } from "./_utils/study-session-access";
import { type StudyBlockStartInput } from "./contract";
import { getDailyTimeLimitStatus } from "./get-daily-time-limit";

type StartedStudyBlock = Pick<
  StudySessionBlock,
  "id" | "kind" | "lessonId" | "startedAt" | "status"
>;

/**
 * `questionsNeeded`: a checkpoint the bank holds too few questions for; once they're written
 * (`requestChallengeQuestions`), starting it again asks them.
 */
export type StartStudyBlockResult =
  | { block: StartedStudyBlock; status: "ready" }
  | { status: "blockFinished" }
  | { status: "dailyLimitReached" }
  | { status: "notFound" }
  | { status: "questionsNeeded" }
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

  const snapshot = await captureSessionSnapshot({ goalId: session.goalId, now, timeZone, userId });

  const opened = await prisma.$transaction(async (tx) => {
    const { count } = await tx.studySession.updateMany({
      data: { startSnapshot: snapshot, startedAt: now, status: "active" },
      where: { id: session.id, startedAt: null },
    });

    if (count === 1) {
      await recordSessionStart(tx, { now, session, timeZone });
    }

    return count === 1;
  });

  if (opened) {
    trackSessionStarted(session);
  }
}

/**
 * Starts (or resumes) one block of the learner's session. The learner's daily limit is checked
 * before anything new starts; a finished block can't start again, and a checkpoint planned before
 * the bank held enough questions for it picks them first (`fillCheckpointQuestions`), with all
 * ten, or what was written once the learner waited for the run writing them (`afterWriting`).
 */
export async function startStudyBlock({
  blockId,
  input,
  sessionId,
}: {
  blockId: string;
  input: StudyBlockStartInput;
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

  const filled = await fillCheckpointQuestions({
    afterWriting: input.afterWriting,
    block,
    goal: session.goal,
    now,
    userId,
  });

  if (!filled) {
    return { status: "questionsNeeded" };
  }

  await openSession({ now, session, timeZone, userId });

  const started = await prisma.studySessionBlock.update({
    data: { startedAt: block.startedAt ?? now, status: "active" },
    select: { id: true, kind: true, lessonId: true, startedAt: true, status: true },
    where: { id: block.id },
  });

  return { block: started, status: "ready" };
}
