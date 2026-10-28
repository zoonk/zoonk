import { mindMapStructureSchema } from "@zoonk/ai/tasks/v2/mind-maps/schema";
import { type ChapterMindMap } from "@zoonk/db";
import {
  type ChapterMindMapView,
  type MindMapOutline,
  type MindMapStatus,
} from "../mind-map-contract";

export const MIND_MAP_STALE_AFTER_MS = 10 * 60 * 1000;

export type MindMapRow = Pick<
  ChapterMindMap,
  "imageHeight" | "imageUrl" | "imageWidth" | "status" | "structure" | "thumbnailUrl" | "updatedAt"
>;

/** Excludes picture-only sketches; returns null for invalid stored structures. */
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

function isRunActive({ now, row }: { now: Date; row: Pick<MindMapRow, "updatedAt"> }) {
  return now.getTime() - row.updatedAt.getTime() < MIND_MAP_STALE_AFTER_MS;
}

/** A completed non-language chapter still needs written lessons before its map can be generated. */
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
