import "server-only";
import { type StudySessionBlock, prisma } from "@zoonk/db";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { readBlockPayload } from "../block-payload";
import { findMissionBlock, getBlockMission } from "../mission-block";
import { type Mission, getMissions } from "../missions";
import { getBlockTitle, getMissionMinutes } from "../missions/mission-time";

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
 * Where a mission still to do opens, as a stored pick's does: the day's first block that counts
 * for it and isn't finished (`findMissionBlock`), or the notebook's practice for a mistake.
 */
function getLegacyOpens({
  blocks,
  kind,
}: {
  blocks: readonly StudySessionBlock[];
  kind: Mission["kind"];
}): Mission["opens"] {
  if (kind === "fixMistake") {
    return { kind: "mistakesPractice" };
  }

  const block = findMissionBlock({
    blocks: blocks.map((row) => ({
      ...readBlockPayload(row),
      id: row.id,
      kind: row.kind,
      status: row.status,
    })),
    kind,
  });

  return block ? { blockId: block.id, kind: "block" } : undefined;
}

/**
 * The day's three missions from the session's planned blocks (extra blocks and reinforcement
 * lessons don't change them). Reviews follow the same completed blocks Today shows, including
 * the first week's placement review and reviews with no capsules. One still to do opens where a
 * stored pick would (`getLegacyOpens`).
 */
export function getSessionMissions({
  availableMistakes,
  blocks,
  fixedToday,
}: {
  /** Open notebook mistakes available now, independently of the day's scheduled drills. */
  availableMistakes: number;
  blocks: readonly StudySessionBlock[];
  fixedToday: number;
}): Mission[] {
  const planned = blocks
    .filter((block) => block.status !== "skipped")
    .map((block) => ({
      block,
      mission: getBlockMission({ ...readBlockPayload(block), kind: block.kind }),
    }));

  const lessons = planned.filter(({ mission }) => mission === "somethingNew");
  const reviews = planned.filter(({ mission }) => mission === "review");

  const missions = getMissions({
    fix: { available: availableMistakes > 0, fixedToday },
    learn: {
      completed: lessons.filter(({ block }) => block.status === "completed").length,
      lessons: lessons.length,
    },
    review: {
      blocks: reviews.length,
      completed: reviews.filter(({ block }) => block.status === "completed").length,
    },
  });

  return missions.map((mission) => {
    if (mission.status !== "todo") {
      return mission;
    }

    const opens = getLegacyOpens({ blocks, kind: mission.kind });
    const next = blocks.find((block) => opens?.kind === "block" && block.id === opens.blockId);
    // One new lesson counts, so only the one it opens is still asked; every review still to do is.
    const counted = mission.kind === "review" ? reviews.map(({ block }) => block) : [];
    const title = next ? getBlockTitle(next) : null;

    const minutes = getMissionMinutes({
      blocks: next && mission.kind === "somethingNew" ? [next] : counted,
      done: mission.done,
      kind: mission.kind,
      total: mission.total,
    });

    return {
      ...mission,
      ...(minutes > 0 && { minutes }),
      ...(opens && { opens }),
      ...(title && { detail: { title } }),
    };
  });
}
