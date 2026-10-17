import "server-only";
import {
  StudyBlockKind,
  StudyBlockStatus,
  type StudySessionBlock,
  StudySessionStatus,
  type TransactionClient,
} from "@zoonk/db";
import { z } from "zod";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { readBlockPayload } from "../block-payload";
import { loadDayPlanVersion } from "./day-plan-version";
import { ONE_PER_DAY } from "./refresh-day-session";
import { lockSessionQueue } from "./session-queue-lock";
import { type StudySessionRow } from "./study-session-access";

const snapshotBlockSchema = z.object({
  canDo: z.string().nullable(),
  estimatedMinutes: z.int().nullable(),
  id: z.string(),
  kind: z.enum(StudyBlockKind),
  lessonId: z.string().nullable(),
  payload: z.record(z.string(), z.json()),
  position: z.int(),
  status: z.enum(StudyBlockStatus),
});

/**
 * Today's session as the learner had it right before a plan change they can undo: its blocks in
 * order with what each holds and how far it got, its minutes and its status. The undo gives it
 * back (see `restoreDaySession`). Built again from the plan instead, the day Ana got back had other
 * lessons and no mistakes practice.
 */
export const daySessionSnapshotSchema = z.object({
  blocks: z.array(snapshotBlockSchema),
  id: z.string(),
  localDate: z.iso.date(),
  plannedMinutes: z.int(),
  status: z.enum(StudySessionStatus),
});

export type DaySessionSnapshot = z.infer<typeof daySessionSnapshotSchema>;

type SnapshotBlock = DaySessionSnapshot["blocks"][number];

type Day = { goalId: string; localDate: Date; userId: string };

/** The day's session as a snapshot keeps it (see `DaySessionSnapshot`); null before it's built. */
export async function captureDaySession({
  goalId,
  localDate,
  tx,
  userId,
}: Day & { tx: TransactionClient }): Promise<DaySessionSnapshot | null> {
  const session = await tx.studySession.findUnique({
    include: { blocks: { orderBy: { position: "asc" } } },
    where: { userGoalDate: { goalId, localDate, userId } },
  });

  if (!session) {
    return null;
  }

  return daySessionSnapshotSchema.parse({
    blocks: session.blocks.map((block) => ({
      canDo: block.canDo,
      estimatedMinutes: block.estimatedMinutes,
      id: block.id,
      kind: block.kind,
      lessonId: block.lessonId,
      payload: block.payload,
      position: block.position,
      status: block.status,
    })),
    id: session.id,
    localDate: toIsoDate(localDate),
    plannedMinutes: session.plannedMinutes,
    status: session.status,
  });
}

function sumMinutes(blocks: readonly Pick<StudySessionBlock, "estimatedMinutes">[]): number {
  return blocks.reduce((sum, block) => sum + (block.estimatedMinutes ?? 0), 0);
}

/** The plan item a challenge block plays. */
function getChallengeItemId(block: Pick<StudySessionBlock, "id" | "payload">): string | null {
  return readBlockPayload(block).planItemId;
}

/**
 * Whether what a block of the snapshot holds is already in blocks the learner started since the
 * change: the same lesson, the day's one practice, review or essay, or the same challenge.
 */
function isHeldBy({
  block,
  since,
}: {
  block: SnapshotBlock;
  since: readonly StudySessionBlock[];
}): boolean {
  return since.some(
    (started) =>
      (block.lessonId !== null && started.lessonId === block.lessonId) ||
      (ONE_PER_DAY.has(block.kind) && started.kind === block.kind) ||
      (block.kind === "checkpoint" &&
        started.kind === "checkpoint" &&
        getChallengeItemId(started) === getChallengeItemId(block)),
  );
}

/**
 * Where the blocks that come back go: their own places, as the learner saw them, unless a block
 * the learner started since took one; then after the day's last block, in their order.
 */
function placeBlocks({
  back,
  staying,
}: {
  back: readonly SnapshotBlock[];
  staying: readonly StudySessionBlock[];
}): SnapshotBlock[] {
  const taken = new Set(staying.map((block) => block.position));

  if (!back.some((block) => taken.has(block.position))) {
    return [...back];
  }

  const first = Math.max(-1, ...taken) + 1;
  return back.map((block, index) => ({ ...block, position: first + index }));
}

/** A day keeps intervening study; without any, it keeps the status it had before the change. */
function getRestoredStatus({
  blocks,
  current,
  progressed,
  snapshot,
}: {
  blocks: readonly Pick<StudySessionBlock, "status">[];
  current: StudySessionStatus;
  progressed: boolean;
  snapshot: StudySessionStatus;
}): StudySessionStatus {
  const status = progressed ? current : snapshot;
  const open = blocks.some((block) => block.status === "pending" || block.status === "active");
  return status === "completed" && open ? "active" : status;
}

/**
 * What giving the day back changes, from its blocks now and the snapshot: the change's blocks not
 * started leave; the learner's started since stay (`since`); the snapshot's blocks not started come
 * back in their places (`back`), but those a block started since already holds (`dropped`); and a
 * block the change skipped is as it was again (`unskipped`).
 */
function planRestore({
  blocks,
  snapshot,
}: {
  blocks: readonly StudySessionBlock[];
  snapshot: DaySessionSnapshot;
}) {
  const before = new Map(snapshot.blocks.map((block) => [block.id, block]));
  const current = new Set(blocks.map((block) => block.id));
  const since = blocks.filter((block) => !before.has(block.id) && block.status !== "pending");

  const returning = snapshot.blocks.filter(
    (block) => block.status === "pending" && !current.has(block.id),
  );

  const back = returning.filter((block) => !isHeldBy({ block, since }));

  return {
    back: placeBlocks({
      back,
      staying: blocks.filter((block) => before.has(block.id) || block.status !== "pending"),
    }),
    dropped: returning.filter((block) => !back.includes(block)),
    leaving: blocks.filter((block) => !before.has(block.id) && block.status === "pending"),
    progressed:
      since.length > 0 ||
      blocks.some((block) => {
        const shown = before.get(block.id);

        return (
          (shown?.status === "pending" &&
            (block.status === "active" ||
              block.status === "completed" ||
              block.startedAt !== null ||
              block.completedAt !== null)) ||
          (shown?.status === "active" &&
            (block.status === "completed" || block.completedAt !== null))
        );
      }),
    since,
    unskipped: blocks.flatMap((block) => {
      const shown = before.get(block.id);

      if (block.status !== "skipped" || !shown || shown.status === "skipped") {
        return [];
      }

      // A block the learner began after the snapshot keeps that work when its skip is undone.
      let status = shown.status;

      if (block.completedAt) {
        status = "completed";
      } else if (block.startedAt) {
        status = "active";
      }

      return [{ ...shown, status }];
    }),
  };
}

/** Locks the original day before any plan writes; another day follows the restored plan instead. */
export async function lockDaySession({
  goalId,
  localDate,
  snapshot,
  tx,
  userId,
}: Day & { snapshot: DaySessionSnapshot; tx: TransactionClient }): Promise<StudySessionRow | null> {
  if (toIsoDate(localDate) !== snapshot.localDate) {
    return null;
  }

  const session = await lockSessionQueue({ sessionId: snapshot.id, tx });

  return session?.goal &&
    session.goalId === goalId &&
    session.userId === userId &&
    toIsoDate(session.localDate) === snapshot.localDate
    ? session
    : null;
}

/**
 * Gives back today's session as the snapshot has it, for an undo: the blocks the change replaced
 * come back as the same rows in their places, so the day is the one the learner had, its missions
 * included, and a screen showing one of them still reaches it. A block the change skipped (a
 * test-out's) is as it was again. What the learner did since stays: a block they started or
 * finished keeps its progress, and a block coming back that it already holds stays out. The caller
 * holds `lockDaySession` in the same transaction as the plan restore. Returns whether a day now
 * without open blocks needs the normal completion settlement after commit.
 */
export async function restoreDaySession({
  session,
  snapshot,
  tx,
}: {
  session: StudySessionRow;
  snapshot: DaySessionSnapshot;
  tx: TransactionClient;
}): Promise<boolean> {
  const { back, dropped, leaving, progressed, since, unskipped } = planRestore({
    blocks: session.blocks,
    snapshot,
  });

  await tx.studySessionBlock.deleteMany({
    where: { id: { in: leaving.map((block) => block.id) }, status: "pending" },
  });

  await Promise.all(
    unskipped.map((block) =>
      tx.studySessionBlock.update({ data: { status: block.status }, where: { id: block.id } }),
    ),
  );

  await tx.studySessionBlock.createMany({
    data: back.map((block) => ({ ...block, sessionId: session.id, status: "pending" as const })),
  });

  // The restored goal and plan are visible only through this transaction until it commits.
  const goal = await tx.goal.findUniqueOrThrow({ where: { id: session.goalId ?? "" } });
  const planVersion = await loadDayPlanVersion({ client: tx, goal, localDate: session.localDate });
  const blocks = await tx.studySessionBlock.findMany({ where: { sessionId: session.id } });

  const status = getRestoredStatus({
    blocks,
    current: session.status,
    progressed,
    snapshot: snapshot.status,
  });

  await tx.studySession.update({
    data: {
      planVersion,
      plannedMinutes: snapshot.plannedMinutes + sumMinutes(since) - sumMinutes(dropped),
      status,
    },
    where: { id: session.id },
  });

  return (
    status === "active" &&
    blocks.every((block) => block.status === "completed" || block.status === "skipped")
  );
}
