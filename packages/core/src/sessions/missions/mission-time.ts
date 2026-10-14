import { type StudySessionBlock } from "@zoonk/db";
import { readBlockPayload } from "../block-payload";
import { type MissionKind } from "./catalog";

/**
 * About how long the missions done outside the day's blocks take, so a mission can say what it
 * still asks in minutes: a mistake's drill is its question again and one or two more on its skill;
 * a pattern drill and a pronunciation round are a few short prompts; a short call and a question to
 * the buddy take a couple of minutes.
 */
const MINUTES_PER_FIX = 2;

const OUTSIDE_MINUTES = {
  askBuddy: 2,
  call: 2,
  pattern: 3,
  pronunciation: 3,
} as const satisfies Partial<Record<MissionKind, number>>;

function isOutsideKind(kind: MissionKind): kind is keyof typeof OUTSIDE_MINUTES {
  return kind in OUTSIDE_MINUTES;
}

/**
 * A lesson's or an essay's name, as the day's queue shows it. Other blocks (reviews, practice,
 * challenges) are named by their kind on screen, so they have none here.
 */
export function getBlockTitle(block: StudySessionBlock): string | null {
  if (block.kind !== "learn" && block.kind !== "produce") {
    return null;
  }

  return readBlockPayload(block).title;
}

/**
 * The minutes a mission still asks: the displayed minutes of its blocks not finished yet (a waiting
 * challenge's too), or an estimate for work outside the day's blocks. Zero once it's done, and
 * for blocks without an estimated length.
 */
export function getMissionMinutes({
  blocks,
  done,
  kind,
  total,
}: {
  /** The day's blocks that count for the mission; empty for a mission done outside them. */
  blocks: readonly (Pick<StudySessionBlock, "estimatedMinutes"> & { status?: string })[];
  done: number;
  kind: MissionKind;
  total: number;
}): number {
  const left = Math.max(0, total - done);

  if (left === 0) {
    return 0;
  }

  if (kind === "fixMistake") {
    return left * MINUTES_PER_FIX;
  }

  if (isOutsideKind(kind)) {
    return OUTSIDE_MINUTES[kind];
  }

  // Only the blocks it still asks for: one new lesson counts, even when every lesson could be it.
  return blocks
    .filter((block) => block.status !== "completed")
    .slice(0, left)
    .reduce((sum, block) => sum + (block.estimatedMinutes ?? 0), 0);
}
