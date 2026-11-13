import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { checkMindMapImage } from "@zoonk/ai/tasks/mind-maps/check";
import { generateMindMapImage } from "@zoonk/ai/tasks/mind-maps/image";
import { mindMapStructureSchema } from "@zoonk/ai/tasks/mind-maps/schema";
import { generateMindMapStructure } from "@zoonk/ai/tasks/mind-maps/structure";
import { prisma } from "@zoonk/db";
import { logInfo } from "@zoonk/utils/logger";
import { readStoredImage } from "../images/read-stored-image";
import { loadMindMapSource } from "./_utils/load-mind-map-source";
import { MIND_MAP_STALE_AFTER_MS } from "./_utils/mind-map-view";
import { saveMindMapImage } from "./_utils/save-mind-map-image";

export type MindMapAnalytics = Pick<AiGenerationContext, "distinctId" | "goalId"> & {
  runId: string;
};

async function findMindMap(chapterId: string) {
  return prisma.chapterMindMap.findUnique({
    include: { chapter: { select: { ownerId: true, visibility: true } } },
    where: { chapterId },
  });
}

function toContext({
  analytics,
  ownerId,
}: {
  analytics: MindMapAnalytics;
  ownerId: string | null;
}): AiGenerationContext {
  return {
    contentScope: ownerId ? "personal" : "shared",
    distinctId: analytics.distinctId,
    goalId: analytics.goalId,
    traceId: analytics.runId,
  };
}

/** Workflow bridge, not authorization: keeps a claimed map on its way while its lessons are written. */
export async function holdChapterMindMap({
  chapterId,
  runId,
}: {
  chapterId: string;
  runId: string;
}): Promise<void> {
  await prisma.chapterMindMap.updateMany({
    data: { runId, updatedAt: new Date() },
    where: { OR: [{ runId }, { runId: null }], chapterId, status: "running" },
  });
}

/** A redraw nobody runs: owed and never tried, or tried by a run that stopped writing to the map. */
function unclaimedRedraw(now: Date) {
  return {
    OR: [
      { redrawAttemptedAt: null, status: "completed" as const },
      {
        status: "running" as const,
        updatedAt: { lt: new Date(now.getTime() - MIND_MAP_STALE_AFTER_MS) },
      },
    ],
    redrawOwedAt: { not: null },
  };
}

/** Workflow bridge, not authorization; requires a learner-claimed run and preserves existing text on retries. */
export async function writeChapterMindMapStructure({
  analytics,
  chapterId,
  redraw = false,
}: {
  analytics: MindMapAnalytics;
  chapterId: string;
  redraw?: boolean;
}): Promise<boolean> {
  const map = await findMindMap(chapterId);

  if (!map) {
    throw new Error(`Chapter ${chapterId} has no mind map to write.`);
  }

  const now = new Date();

  const claimed = await prisma.chapterMindMap.updateMany({
    data: {
      runId: analytics.runId,
      ...(redraw ? { redrawAttemptedAt: now, status: "running", updatedAt: now } : {}),
    },
    where: {
      chapterId,
      ...(redraw
        ? {
            OR: [
              unclaimedRedraw(now),
              { redrawOwedAt: { not: null }, runId: analytics.runId, status: "running" },
            ],
          }
        : { OR: [{ runId: null }, { runId: analytics.runId }], status: "running" }),
    },
  });

  if (claimed.count === 0) {
    return false;
  }

  if (map.structure) {
    return true;
  }

  const source = await loadMindMapSource(chapterId);

  if (!source) {
    throw new Error(`Chapter ${chapterId} has no written lessons to make a mind map from.`);
  }

  const { data, provenance } = await generateMindMapStructure({
    analytics: toContext({ analytics, ownerId: map.chapter.ownerId }),
    chapter: source,
  });

  await prisma.chapterMindMap.update({
    data: {
      language: source.language,
      model: provenance.model,
      promptVersion: provenance.promptVersion,
      structure: data,
    },
    where: { chapterId },
  });

  return true;
}

const NO_IMAGE = {
  imageHeight: null,
  imageModel: null,
  imageUrl: null,
  imageWidth: null,
  thumbnailUrl: null,
} as const;

export type DrawnMindMap = { image: Uint8Array; model: string };

/** Workflow bridge, not authorization; without corrections returns null for an already-stored picture. Store in a separate durable step to avoid paying twice. */
export async function drawChapterMindMap({
  analytics,
  chapterId,
  corrections = [],
}: {
  analytics: MindMapAnalytics;
  chapterId: string;
  corrections?: readonly string[];
}): Promise<DrawnMindMap | null> {
  const map = await findMindMap(chapterId);
  const structure = mindMapStructureSchema.safeParse(map?.structure);

  if (!map || !structure.success) {
    throw new Error(`Chapter ${chapterId}'s mind map has no text to draw.`);
  }

  if (map.runId !== analytics.runId || (map.imageUrl && corrections.length === 0)) {
    return null;
  }

  const ownerId = map.chapter.visibility === "private" ? map.chapter.ownerId : null;

  const { data, provenance } = await generateMindMapImage({
    analytics: toContext({ analytics, ownerId }),
    corrections,
    language: map.language,
    structure: structure.data,
  });

  return { image: data.image, model: provenance.model };
}

/** Workflow bridge, not authorization; show immediately, then check text afterward. Null drawn only finishes an already-stored map. Writes nothing once runId lost the map. */
export async function showChapterMindMap({
  chapterId,
  drawn,
  runId,
}: {
  chapterId: string;
  drawn: DrawnMindMap | null;
  runId: string;
}): Promise<void> {
  const map = await findMindMap(chapterId);

  if (map?.runId !== runId) {
    return;
  }

  if (!drawn) {
    await prisma.chapterMindMap.updateMany({
      data: {
        generatedAt: map.generatedAt ?? new Date(),
        status: map.redrawOwedAt ? "running" : "completed",
      },
      where: { chapterId, runId },
    });

    return;
  }

  const ownerId = map.chapter.visibility === "private" ? map.chapter.ownerId : null;
  const saved = await saveMindMapImage({ image: drawn.image, ownerId });

  await prisma.chapterMindMap.updateMany({
    data: {
      generatedAt: new Date(),
      imageHeight: saved.height,
      imageModel: drawn.model,
      imageUrl: saved.url,
      imageWidth: saved.width,
      status: map.redrawOwedAt ? "running" : "completed",
      thumbnailUrl: saved.thumbnailUrl,
    },
    where: { chapterId, runId },
  });
}

export type MindMapImageCheck = { imageUrl: string | null; passed: boolean; problems: string[] };

/** Workflow bridge, not authorization; runs after display and treats maps without a picture as passed. */
export async function checkChapterMindMapImage({
  analytics,
  chapterId,
}: {
  analytics: MindMapAnalytics;
  chapterId: string;
}): Promise<MindMapImageCheck> {
  const map = await findMindMap(chapterId);
  const structure = mindMapStructureSchema.safeParse(map?.structure);

  if (!map?.imageUrl || !structure.success) {
    return { imageUrl: null, passed: true, problems: [] };
  }

  const ownerId = map.chapter.visibility === "private" ? map.chapter.ownerId : null;
  const image = await readStoredImage({ url: map.imageUrl });

  const { data } = await checkMindMapImage({
    analytics: toContext({ analytics, ownerId }),
    image,
    language: map.language,
    structure: structure.data,
  });

  if (!data.passed) {
    logInfo("[mind-maps] A mind map's picture failed its text check", {
      chapterId,
      problems: data.problems,
    });
  }

  return { imageUrl: map.imageUrl, passed: data.passed, problems: data.problems };
}

/** Workflow bridge, not authorization; removes only the named current image link of a map runId still owns and preserves the file for open readers. */
export async function removeChapterMindMapImage({
  chapterId,
  imageUrl,
  runId,
}: {
  chapterId: string;
  imageUrl: string;
  runId: string;
}): Promise<void> {
  await prisma.chapterMindMap.updateMany({ data: NO_IMAGE, where: { chapterId, imageUrl, runId } });
}

/** Workflow bridge, not authorization; runId must still own the map. */
export async function failChapterMindMap({
  chapterId,
  runId,
}: {
  chapterId: string;
  runId: string;
}): Promise<void> {
  await prisma.chapterMindMap.updateMany({
    data: { redrawOwedAt: null, status: "completed" },
    where: { chapterId, redrawOwedAt: { not: null }, runId },
  });

  await prisma.chapterMindMap.updateMany({
    data: { status: "failed" },
    where: { OR: [{ runId }, { runId: null }], chapterId, status: "running" },
  });
}

export async function finishChapterMindMapRedraw({
  chapterId,
  runId,
}: {
  chapterId: string;
  runId: string;
}): Promise<void> {
  await prisma.chapterMindMap.updateMany({
    data: { redrawOwedAt: null, status: "completed" },
    where: { chapterId, runId },
  });
}

export async function listOwedMindMapRedraws(): Promise<string[]> {
  const rows = await prisma.chapterMindMap.findMany({
    orderBy: { redrawOwedAt: "asc" },
    take: 100,
    where: unclaimedRedraw(new Date()),
  });

  return rows.map((row) => row.chapterId);
}
