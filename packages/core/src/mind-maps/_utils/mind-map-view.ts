import { mindMapStructureSchema } from "@zoonk/ai/tasks/v2/mind-maps/schema";
import { type ChapterMindMap } from "@zoonk/db";
import {
  type ChapterMindMapView,
  type MindMapOutline,
  type MindMapStatus,
} from "../mind-map-contract";

/**
 * A run that hasn't touched its map for this long stopped (a crash or a deploy): the map counts
 * as failed, so the learner can ask again. Writing and drawing a map takes under a minute; its
 * check and any redraw run after it's shown.
 */
export const MIND_MAP_STALE_AFTER_MS = 10 * 60 * 1000;

export type MindMapRow = Pick<
  ChapterMindMap,
  "imageHeight" | "imageUrl" | "imageWidth" | "status" | "structure" | "thumbnailUrl" | "updatedAt"
>;

export const MIND_MAP_ROW_SELECT = {
  imageHeight: true,
  imageUrl: true,
  imageWidth: true,
  status: true,
  structure: true,
  thumbnailUrl: true,
  updatedAt: true,
} as const;

/** The stored structure as learners read it, without the sketches the picture draws. */
export function toMindMapOutline(structure: unknown): MindMapOutline | null {
  const parsed = mindMapStructureSchema.safeParse(structure);

  if (!parsed.success) {
    return null;
  }

  const { branches, centralIdea, comparison, summary, title } = parsed.data;

  return {
    branches: branches.map(({ explanation, points, title: name }) => ({
      explanation,
      points,
      title: name,
    })),
    centralIdea,
    comparison,
    summary,
    title,
  };
}

export function toMindMapImage(row: MindMapRow | null): ChapterMindMapView["image"] {
  if (!row?.imageUrl || !row.thumbnailUrl || !row.imageWidth || !row.imageHeight) {
    return null;
  }

  return {
    height: row.imageHeight,
    thumbnailUrl: row.thumbnailUrl,
    url: row.imageUrl,
    width: row.imageWidth,
  };
}

/** A run still working on its map, as opposed to one that stopped without saying so. */
function isRunActive({ now, row }: { now: Date; row: Pick<MindMapRow, "updatedAt"> }) {
  return now.getTime() - row.updatedAt.getTime() < MIND_MAP_STALE_AFTER_MS;
}

/**
 * Where a chapter's map stands for one learner. Maps are for chapters they finished, outside a
 * language's units; a finished chapter can get one once some of its lessons are written, since a
 * map is drawn from what they teach.
 */
export function getMindMapStatus({
  canHaveMap,
  hasWrittenLessons,
  now,
  row,
}: {
  /** The learner finished the chapter and it isn't a language's unit. */
  canHaveMap: boolean;
  hasWrittenLessons: boolean;
  now: Date;
  row: MindMapRow | null;
}): MindMapStatus {
  if (!canHaveMap) {
    return "unavailable";
  }

  if (row?.status === "completed" && toMindMapOutline(row.structure)) {
    return "ready";
  }

  if (row?.status === "running" && isRunActive({ now, row })) {
    return "generating";
  }

  if (!hasWrittenLessons) {
    return "unavailable";
  }

  return row && row.status !== "pending" ? "failed" : "available";
}
