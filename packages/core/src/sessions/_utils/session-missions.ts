import "server-only";
import { type StudySessionBlock, prisma } from "@zoonk/db";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { readBlockPayload } from "../block-payload";
import { type Mission, getMissions } from "../missions";

/** Capsules count as opened once any of their questions is answered. */
function countOpenedCapsules({
  answeredItemIds,
  blocks,
}: {
  answeredItemIds: ReadonlySet<string>;
  blocks: readonly StudySessionBlock[];
}): { opened: number; total: number } {
  const capsules = blocks
    .filter((block) => block.kind === "review")
    .flatMap((block) => readBlockPayload(block).capsules);

  return {
    opened: capsules.filter((capsule) => capsule.itemIds.some((id) => answeredItemIds.has(id)))
      .length,
    total: capsules.length,
  };
}

/** Mistakes the learner fixed today, however they fixed them. */
export function countMistakesFixedToday({
  localDate,
  timeZone,
  userId,
}: {
  localDate: Date;
  timeZone: string;
  userId: string;
}): Promise<number> {
  return prisma.mistake.count({
    where: {
      fixedAt: { gte: getStartOfLocalDay({ localDate, timeZone }) },
      status: "fixed",
      userId,
    },
  });
}

/**
 * The day's three missions from the session's planned blocks (extra blocks and reinforcement
 * lessons don't change them) and the answers given so far.
 */
export function getSessionMissions({
  answeredItemIds,
  blocks,
  fixedToday,
}: {
  answeredItemIds: ReadonlySet<string>;
  blocks: readonly StudySessionBlock[];
  fixedToday: number;
}): Mission[] {
  const planned = blocks.filter((block) => !readBlockPayload(block).extra);

  const lessons = planned.filter(
    (block) => block.kind === "learn" && !readBlockPayload(block).reinforcement,
  );

  const capsules = countOpenedCapsules({ answeredItemIds, blocks: planned });

  return getMissions({
    fix: {
      available: planned.some((block) => readBlockPayload(block).drills.length > 0),
      fixedToday,
    },
    learn: {
      completed: lessons.filter((block) => block.status === "completed").length,
      lessons: lessons.length,
    },
    review: { capsules: capsules.total, opened: capsules.opened },
  });
}
