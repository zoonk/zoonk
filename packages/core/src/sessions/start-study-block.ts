import "server-only";
import { type StudySessionBlock, type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getUserProgressCacheTag, getUserSessionCacheTag } from "../cache/tags";
import { fillCheckpointQuestions } from "../checkpoints/_utils/fill-checkpoint-questions";
import { arePhaseChallengesRequired } from "../checkpoints/_utils/phase-challenge-access";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { getCompletionEnergyContext } from "../stats/completion-energy";
import {
  getBlockElapsedMs,
  lockStudyBlockClocks,
  pauseOtherStudyBlocks,
} from "./_utils/block-timing";
import { captureSessionSnapshot } from "./_utils/capture-snapshot";
import { trackSessionStarted } from "./_utils/session-events";
import { recordSessionStart } from "./_utils/session-ledger";
import { type SessionSnapshot } from "./_utils/session-snapshot";
import {
  STUDY_SESSION_INCLUDE,
  type StudySessionRow,
  findOwnedStudyBlock,
} from "./_utils/study-session-access";
import { readBlockPayload } from "./block-payload";
import { getStoredBlockWait } from "./block-wait";
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
  | { reason: "challenge" | "lessons"; status: "earlierFirst" }
  | { status: "notFound" }
  | { status: "plusRequired" }
  | { status: "questionsNeeded" }
  | { status: "unauthorized" };

/** Replays and refusals must roll back the revision taken before the domain locks. */
class StudyBlockStartUnchangedError extends Error {
  readonly result: StartStudyBlockResult;

  constructor(result: StartStudyBlockResult) {
    super(result.status);
    this.name = "StudyBlockStartUnchangedError";
    this.result = result;
  }
}

function isRunningBlock(block: StudySessionBlock): boolean {
  const timing = readBlockPayload(block).timing;
  return block.status === "active" && Boolean(timing ? timing.activeAt : block.startedAt);
}

/**
 * The first block to start opens the session: it records where the learner stands (so the end
 * can say what changed), writes the session's ledger row and sends "Session Started". Later
 * starts leave all three alone.
 */
async function openSession({
  now,
  session,
  snapshot,
  timeZone,
  tx,
}: {
  now: Date;
  session: StudySessionRow;
  snapshot: SessionSnapshot | null;
  timeZone: string;
  tx: TransactionClient;
}): Promise<boolean> {
  const opened = session.startedAt === null;
  const saved = session.startSnapshot;

  const startSnapshot = {
    ...(saved !== null && typeof saved === "object" && !Array.isArray(saved) ? saved : {}),
    ...snapshot,
  };

  await tx.studySession.update({
    data: { ...(opened && { startSnapshot, startedAt: now }), status: "active" },
    where: { id: session.id },
  });

  if (opened) {
    await recordSessionStart(tx, { now, session, timeZone });
  }

  return opened;
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

  const checkpoint = readBlockPayload(block).checkpoint;

  if (
    block.kind === "checkpoint" &&
    checkpoint &&
    !checkpoint.mock &&
    checkpoint.kind !== "weekly" &&
    session.goal &&
    !(await arePhaseChallengesRequired({ goalKind: session.goal.kind, userId }))
  ) {
    return { status: "plusRequired" };
  }

  const snapshotAt = new Date();
  const timeZone = getAnswerTimeZone({ goal: session.goal, timeZone: input.timeZone });

  /** Snapshot reads use the global client; finish them before owning any transition locks. */
  const [limit, snapshot] = await Promise.all([
    getDailyTimeLimitStatus(),
    session.startedAt
      ? null
      : captureSessionSnapshot({ goalId: session.goalId, now: snapshotAt, timeZone, userId }),
  ]);

  const attempt = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { userId });

      const { completedAt: now } = await getCompletionEnergyContext({
        timeZone,
        transaction: tx,
        userId,
      });

      const lockedIds = await lockStudyBlockClocks({ blockId, tx, userId });

      const current = await tx.studySessionBlock.findUnique({ where: { id: blockId } });

      if (!current || current.sessionId !== sessionId) {
        throw new StudyBlockStartUnchangedError({ status: "notFound" });
      }

      if (current.status === "completed" || current.status === "skipped") {
        throw new StudyBlockStartUnchangedError({ status: "blockFinished" });
      }

      if (current.status === "pending" && limit?.reached) {
        throw new StudyBlockStartUnchangedError({ status: "dailyLimitReached" });
      }

      await tx.$queryRaw`
      SELECT id FROM study_sessions WHERE id = ${sessionId}::uuid FOR NO KEY UPDATE
    `;

      const locked = await tx.studySession.findFirst({
        include: STUDY_SESSION_INCLUDE,
        where: { id: sessionId, userId },
      });

      if (!locked) {
        throw new StudyBlockStartUnchangedError({ status: "notFound" });
      }

      const wait = getStoredBlockWait({ block: current, blocks: locked.blocks });

      if (wait) {
        throw new StudyBlockStartUnchangedError({ reason: wait, status: "earlierFirst" });
      }

      if (locked.status === "active" && locked.startedAt && isRunningBlock(current)) {
        const { id, kind, lessonId, startedAt, status } = current;

        throw new StudyBlockStartUnchangedError({
          block: { id, kind, lessonId, startedAt, status },
          status: "ready",
        });
      }

      const filled = await fillCheckpointQuestions({
        afterWriting: input.afterWriting,
        block: current,
        goal: locked.goal,
        now,
        tx,
        userId,
      });

      if (!filled) {
        throw new StudyBlockStartUnchangedError({ status: "questionsNeeded" });
      }

      const opened = await openSession({ now, session: locked, snapshot, timeZone, tx });

      await pauseOtherStudyBlocks({ blockId, lockedIds, now, tx });
      /** Filling a checkpoint may have replaced its payload; preserve the questions it just picked. */
      const filledBlock = await tx.studySessionBlock.findUniqueOrThrow({
        where: { id: current.id },
      });

      const started = await tx.studySessionBlock.update({
        data: {
          payload: {
            ...readBlockPayload(filledBlock),
            timing: {
              ...readBlockPayload(filledBlock).timing,
              activeAt: now.toISOString(),
              elapsedMs: getBlockElapsedMs({ block: filledBlock, now }),
            },
          },
          startedAt: current.startedAt ?? now,
          status: "active",
        },
        select: { id: true, kind: true, lessonId: true, startedAt: true, status: true },
        where: { id: current.id },
      });

      return { block: started, opened, session: locked, status: "ready" as const };
    }),
  );

  if (attempt.error instanceof StudyBlockStartUnchangedError) {
    return attempt.error.result;
  }

  if (attempt.error) {
    throw attempt.error;
  }

  const result = attempt.data;
  revalidateCacheTags([getUserProgressCacheTag(userId), getUserSessionCacheTag(userId)]);

  if (result.opened) {
    trackSessionStarted(result.session);
  }

  return { block: result.block, status: "ready" };
}
