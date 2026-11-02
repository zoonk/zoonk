import { type StudySessionBlock } from "@zoonk/db";
import { readBlockPayload } from "../block-payload";
import { type MissionKind } from "./catalog";

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

/** Returns null for non-lesson/non-essay blocks; display names those by kind. */
export function getBlockTitle(
  block: Pick<StudySessionBlock, "kind" | "payload"> & { id?: string },
): string | null {
  if (block.kind !== "learn" && block.kind !== "produce") {
    return null;
  }

  return readBlockPayload(block).title;
}

/** Uses displayed unfinished-block durations or off-session estimates; completed missions return zero. */
export function getMissionMinutes({
  blocks,
  done,
  kind,
  total,
}: {
  /** Empty for missions completed outside the day's blocks. */
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

  return blocks
    .filter((block) => block.status !== "completed")
    .slice(0, left)
    .reduce((sum, block) => sum + (block.estimatedMinutes ?? 0), 0);
}
