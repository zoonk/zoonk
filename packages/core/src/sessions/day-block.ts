import { type GoalKind } from "@zoonk/db";
import { z } from "zod";
import { type MockIdentity } from "../plans/planner/mock-identity";
import { type DayView } from "./day-view";

const MAX_PLAN_ITEM_KEY_LENGTH = 120;
const MAX_AREA_ID_LENGTH = 100;

/** An area of the goal's map: a chapter's id, or `phase:N` for skills not in a chapter yet. */
export const areaIdSchema = z.string().min(1).max(MAX_AREA_ID_LENGTH);

/** A scheduled mock fixes its exam day and length when the day is built. */
export const mockIdentitySchema: z.ZodType<MockIdentity> = z
  .object({ day: z.int().positive().nullable(), fullLength: z.boolean() })
  .strict();

const checkpointRefShape = {
  kind: z.enum(["boss", "finalBoss", "weekly"]),
  phase: z.int().nullable(),
  rematch: z.boolean(),
};

export const checkpointRefSchema = z.discriminatedUnion("mock", [
  z
    .object({ ...checkpointRefShape, mock: z.literal(true), mockIdentity: mockIdentitySchema })
    .strict(),
  z.object({ ...checkpointRefShape, mock: z.literal(false) }).strict(),
]);

/** A position is a delivery hint; matching uses the work's identity and flags. */
export const dayBlockRefSchema = z
  .object({
    areaId: areaIdSchema.nullable(),
    chapterId: z.uuid().nullable(),
    checkpoint: checkpointRefSchema.nullable(),
    flags: z
      .object({
        extra: z.boolean(),
        fullReview: z.boolean(),
        mistakesOnly: z.boolean(),
        refresh: z.boolean(),
        reinforcement: z.boolean(),
        weakest: z.boolean(),
      })
      .strict(),
    kind: z.enum(["learn", "review", "practice", "produce", "checkpoint"]),
    lessonId: z.uuid().nullable(),
    planItemKey: z.string().max(MAX_PLAN_ITEM_KEY_LENGTH).nullable(),
    position: z.int().nonnegative(),
  })
  .strict();

export type DayBlockRef = z.infer<typeof dayBlockRefSchema>;
export type DayWork = Omit<DayBlockRef, "flags" | "checkpoint"> &
  DayBlockRef["flags"] & {
    checkpoint:
      | (Omit<NonNullable<DayBlockRef["checkpoint"]>, "mockIdentity" | "mock"> & {
          mock: boolean;
          mockIdentity?: MockIdentity;
        })
      | null;
  };

/** Unknown readiness must go through the learner's action before navigating to a player. */
export function getDayBlockScreen(
  block: Pick<DayWork, "kind" | "lessonId">,
  { lessonReady }: { lessonReady: boolean | null },
): "session" | "lesson" | "challenge" | "essay" | "unknown" {
  if (block.kind === "learn") {
    if (lessonReady === null) {
      return "unknown";
    }

    return lessonReady && block.lessonId ? "lesson" : "session";
  }

  if (block.kind === "checkpoint") {
    return "challenge";
  }

  return block.kind === "produce" ? "essay" : "session";
}

export function toDayBlockRef(block: DayWork): DayBlockRef {
  return {
    areaId: block.areaId,
    chapterId: block.chapterId,
    checkpoint: block.checkpoint
      ? checkpointRefSchema.parse({
          kind: block.checkpoint.kind,
          mock: block.checkpoint.mock,
          ...(block.checkpoint.mock && { mockIdentity: block.checkpoint.mockIdentity }),
          phase: block.checkpoint.phase,
          rematch: block.checkpoint.rematch,
        })
      : null,
    flags: {
      extra: block.extra,
      fullReview: block.fullReview,
      mistakesOnly: block.mistakesOnly,
      refresh: block.refresh,
      reinforcement: block.reinforcement,
      weakest: block.weakest,
    },
    kind: block.kind,
    lessonId: block.lessonId,
    planItemKey: block.planItemKey,
    position: block.position,
  };
}

function hasSameCheckpoint(first: DayBlockRef["checkpoint"], second: DayBlockRef["checkpoint"]) {
  if (!first || !second) {
    return first === second;
  }

  return (
    first.kind === second.kind &&
    first.mock === second.mock &&
    first.phase === second.phase &&
    first.rematch === second.rematch &&
    (!first.mock ||
      (second.mock &&
        first.mockIdentity.day === second.mockIdentity.day &&
        first.mockIdentity.fullLength === second.mockIdentity.fullLength))
  );
}

/** Never opens different work just because it occupies the same position after a change. */
export function isSameDayWork(first: DayBlockRef, second: DayBlockRef): boolean {
  return (
    first.kind === second.kind &&
    first.lessonId === second.lessonId &&
    first.chapterId === second.chapterId &&
    first.areaId === second.areaId &&
    first.planItemKey === second.planItemKey &&
    hasSameCheckpoint(first.checkpoint, second.checkpoint) &&
    first.flags.extra === second.flags.extra &&
    first.flags.fullReview === second.flags.fullReview &&
    first.flags.mistakesOnly === second.flags.mistakesOnly &&
    first.flags.refresh === second.flags.refresh &&
    first.flags.reinforcement === second.flags.reinforcement &&
    first.flags.weakest === second.flags.weakest
  );
}

/** Duplicate matching work is ambiguous; the learner must see the fresh list before choosing. */
export function resolveDayBlock<Block extends DayWork>({
  blocks,
  ref,
}: {
  blocks: readonly Block[];
  ref: DayBlockRef;
}): { block: Block; status: "resolved" } | { status: "gone" | "ambiguous" } {
  const matches = blocks.filter((block) => isSameDayWork(ref, toDayBlockRef(block)));

  const block = matches[0];

  if (matches.length !== 1 || !block) {
    return { status: matches.length === 0 ? "gone" : "ambiguous" };
  }

  return { block, status: "resolved" };
}

/** Read-only link for an unstarted saved language call; returns null when Continue must resume through a POST. */
export function findNextCall({
  goalKind,
  session,
}: {
  goalKind: GoalKind;
  session: DayView;
}): { blockId: string; sessionId: string } | null {
  if (goalKind !== "language" || session.status === "unstarted" || !session.current) {
    return null;
  }

  const block = session.blocks.find((candidate) => candidate.id === session.nextBlockId);
  const checkpoint = block?.checkpoint;

  if (
    block?.status !== "pending" ||
    !checkpoint ||
    checkpoint.mock ||
    checkpoint.kind === "weekly" ||
    block.waitReason
  ) {
    return null;
  }

  return { blockId: block.id, sessionId: session.id };
}
