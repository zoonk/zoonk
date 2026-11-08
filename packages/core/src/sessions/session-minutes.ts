import { z } from "zod";
import { readBlockPayload } from "./block-payload";

export const sessionMinutesSchema = z
  .object({
    dailyGoal: z
      .number()
      .nonnegative()
      .meta({
        description: "The allocated daily study budget in exact minutes, which may be fractional.",
      }),
    done: z
      .number()
      .int()
      .nonnegative()
      .meta({
        description:
          "Personal estimated minutes of completed blocks. Study statistics report elapsed time separately.",
      }),
    left: z
      .number()
      .nonnegative()
      .meta({
        description:
          "Time left in the day's commitment. Completed lessons credit measured time within 0.5–2.5 times their raw estimate; skipped blocks credit nothing. Includes reserved lessons. Clients display this value without rebuilding it from blocks.",
      }),
    planned: z
      .number()
      .int()
      .nonnegative()
      .meta({
        description:
          "The day's total commitment, persisted at Start, including reserved lessons and accepted extra time.",
      }),
  })
  .meta({ id: "StudySessionMinutes" });

export type SessionMinutes = z.infer<typeof sessionMinutesSchema>;

type MinuteBlock = { status: string; estimatedMinutes: number | null; payload?: unknown };

export function getCreditedMinutes(block: MinuteBlock): number {
  if (block.status !== "completed") {
    return 0;
  }

  return (
    readBlockPayload({ payload: block.payload ?? {} }).creditedMinutes ??
    block.estimatedMinutes ??
    0
  );
}

function getUsedBlockMinutes(block: MinuteBlock): number {
  if (block.status === "completed") {
    return getCreditedMinutes(block);
  }

  return block.status === "skipped" ? 0 : (block.estimatedMinutes ?? 0);
}

export function getSessionUsedMinutes(blocks: readonly MinuteBlock[]): number {
  return blocks.reduce((sum, block) => sum + getUsedBlockMinutes(block), 0);
}

export function getVisibleSessionTotal({
  blocks,
  planned,
  visibleIds,
}: {
  blocks: readonly { id: string; estimatedMinutes: number | null }[];
  planned: number;
  visibleIds: ReadonlySet<string>;
}): number {
  return Math.max(
    0,
    planned -
      blocks
        .filter((block) => !visibleIds.has(block.id))
        .reduce((sum, block) => sum + (block.estimatedMinutes ?? 0), 0),
  );
}

export function getSessionMinutes({
  blocks,
  dailyGoal,
  planned,
  reserved = false,
}: {
  blocks: readonly MinuteBlock[];
  dailyGoal: number;
  planned: number;
  reserved?: boolean;
}): SessionMinutes {
  const unfinished = blocks.filter(
    (block) => block.status === "pending" || block.status === "active",
  );

  const next = blocks.find((block) => block.status === "active") ?? unfinished[0];

  return {
    dailyGoal,
    done: Math.round(
      blocks.reduce(
        (sum, block) => sum + (block.status === "completed" ? (block.estimatedMinutes ?? 0) : 0),
        0,
      ),
    ),
    left:
      unfinished.length === 0 && !reserved
        ? 0
        : Math.max(
            0,
            planned - blocks.reduce((sum, block) => sum + getCreditedMinutes(block), 0),
            next?.estimatedMinutes ?? 0,
          ),
    planned,
  };
}
