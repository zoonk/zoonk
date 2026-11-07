import { mindMapStructureSchema } from "@zoonk/ai/tasks/mind-maps/schema";
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
function toMindMapOutline(structure: unknown): MindMapOutline | null {
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

function toMindMapImage(row: MindMapRow | null): ChapterMindMapView["image"] {
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

/** A map that's owed counts as on its way, even while its run waits for a failed start's retry. */
export function getMindMapStatus({
  canHaveMap,
  lessonsToWrite,
  now,
  owed,
  plusRequired,
  row,
}: {
  canHaveMap: boolean;
  lessonsToWrite: number;
  now: Date;
  owed: boolean;
  plusRequired: boolean;
  row: MindMapRow | null;
}): MindMapStatus {
  if (!canHaveMap) {
    return "unavailable";
  }

  if (plusRequired) {
    return "plusRequired";
  }

  if (row?.status === "completed" && toMindMapOutline(row.structure)) {
    return "ready";
  }

  if (owed || (row?.status === "running" && isRunActive({ now, row }))) {
    return lessonsToWrite > 0 ? "writingLessons" : "drawing";
  }

  return row && row.status !== "pending" ? "failed" : "available";
}

type ChapterMapFacts = Omit<Parameters<typeof getMindMapStatus>[0], "now"> & {
  chapterId: string;
  title: string;
};

/** Only a ready map hands out its picture and outline. */
export function toChapterMindMapView({
  facts,
  now,
  position,
}: {
  facts: ChapterMapFacts;
  now: Date;
  position: number;
}): ChapterMindMapView {
  const status = getMindMapStatus({ ...facts, now });
  const isReady = status === "ready";

  return {
    chapterId: facts.chapterId,
    image: isReady ? toMindMapImage(facts.row) : null,
    lessonsToWrite: facts.lessonsToWrite,
    outline: isReady ? toMindMapOutline(facts.row?.structure) : null,
    position,
    status,
    title: facts.title,
  };
}
