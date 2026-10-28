import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { checkMindMapImage } from "@zoonk/ai/tasks/v2/mind-maps/check";
import { generateMindMapImage } from "@zoonk/ai/tasks/v2/mind-maps/image";
import { mindMapStructureSchema } from "@zoonk/ai/tasks/v2/mind-maps/schema";
import { generateMindMapStructure } from "@zoonk/ai/tasks/v2/mind-maps/structure";
import { prisma } from "@zoonk/db";
import { logInfo } from "@zoonk/utils/logger";
import { readStoredImage } from "../images/read-stored-image";
import { loadMindMapSource } from "./_utils/load-mind-map-source";
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

/** Workflow bridge, not authorization; requires a learner-claimed run and preserves existing text on retries. */
export async function writeChapterMindMapStructure({
  analytics,
  chapterId,
}: {
  analytics: MindMapAnalytics;
  chapterId: string;
}): Promise<void> {
  const map = await findMindMap(chapterId);

  if (!map) {
    throw new Error(`Chapter ${chapterId} has no mind map to write.`);
  }

  await prisma.chapterMindMap.update({ data: { runId: analytics.runId }, where: { chapterId } });

  if (map.structure) {
    return;
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

  if (map.imageUrl && corrections.length === 0) {
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

/** Workflow bridge, not authorization; show immediately, then check text afterward. Null drawn only finishes an already-stored map. */
export async function showChapterMindMap({
  chapterId,
  drawn,
}: {
  chapterId: string;
  drawn: DrawnMindMap | null;
}): Promise<void> {
  const map = await findMindMap(chapterId);

  if (!map) {
    throw new Error(`Chapter ${chapterId} has no mind map to show.`);
  }

  if (!drawn) {
    await prisma.chapterMindMap.update({
      data: { generatedAt: map.generatedAt ?? new Date(), status: "completed" },
      where: { chapterId },
    });

    return;
  }

  const ownerId = map.chapter.visibility === "private" ? map.chapter.ownerId : null;
  const saved = await saveMindMapImage({ image: drawn.image, ownerId });

  await prisma.chapterMindMap.update({
    data: {
      generatedAt: new Date(),
      imageHeight: saved.height,
      imageModel: drawn.model,
      imageUrl: saved.url,
      imageWidth: saved.width,
      status: "completed",
      thumbnailUrl: saved.thumbnailUrl,
    },
    where: { chapterId },
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

/** Workflow bridge, not authorization; removes only the named current image link and preserves the file for open readers. */
export async function removeChapterMindMapImage({
  chapterId,
  imageUrl,
}: {
  chapterId: string;
  imageUrl: string;
}): Promise<void> {
  await prisma.chapterMindMap.updateMany({ data: NO_IMAGE, where: { chapterId, imageUrl } });
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
    data: { status: "failed" },
    where: { OR: [{ runId }, { runId: null }], chapterId, status: "running" },
  });
}
