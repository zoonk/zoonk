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
import { ONE_PER_DAY } from "./day-block-content";
import { loadDayPlanVersion } from "./day-plan-version";
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

/** Undo must preserve the exact saved day's rows, order, and missions rather than rebuilding another day. */
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

/** Null before the day's session exists. */
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

function getChallengeItemId(block: Pick<StudySessionBlock, "id" | "payload">): string | null {
  return readBlockPayload(block).planItemId;
}

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

/** Restore shown positions unless intervening started work occupies them; append those returning blocks in order. */
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

/** Preserve intervening study; otherwise restore the original day status. */
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

      // Undoing a skip must preserve work started after the snapshot.
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

/** Caller must hold lockDaySession in the plan-restore transaction. Preserves intervening study and returns whether completion needs settlement after commit. */
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

  // Restored goal and plan values are visible only through the transaction until commit.
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
