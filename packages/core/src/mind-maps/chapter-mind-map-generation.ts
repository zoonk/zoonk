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

/** Who asked and the run, so the map's AI cost adds up per learner and run. */
export type MindMapAnalytics = Pick<AiGenerationContext, "distinctId" | "goalId"> & {
  runId: string;
};

async function findMindMap(chapterId: string) {
  return prisma.chapterMindMap.findUnique({
    include: { chapter: { select: { ownerId: true, visibility: true } } },
    where: { chapterId },
  });
}

/** A private chapter's map is personal to its owner; a shared chapter's is shared content. */
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

/**
 * Writes a chapter's mind map as text from its written lessons, the first part of the run a
 * learner's request claimed (`requestChapterMindMap`). The run takes the map as its own; a retry
 * that finds the text written keeps it.
 *
 * This is a workflow bridge, not an app authorization boundary.
 */
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

/** The picture's columns, empty: a map without a picture is its outline. */
const NO_IMAGE = {
  imageHeight: null,
  imageModel: null,
  imageUrl: null,
  imageWidth: null,
  thumbnailUrl: null,
} as const;

/** A picture just drawn for a chapter's map, before it's stored. */
export type DrawnMindMap = { image: Uint8Array; model: string };

/**
 * Draws the map written for the chapter. `corrections` (what the text check found) draw it again
 * to replace the picture; without them, a retry that finds the picture stored draws nothing
 * (null). Storing it is `showChapterMindMap`, apart, so a store that fails never pays for the
 * drawing again.
 *
 * This is a workflow bridge, not an app authorization boundary.
 */
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

/**
 * Stores a picture just drawn, with a small copy for lists, and finishes the map, so learners see
 * it right away; its text is checked afterwards (`checkChapterMindMapImage`). Without a new picture
 * (a retry that found it stored), it only finishes the map.
 *
 * This is a workflow bridge, not an app authorization boundary.
 */
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

/** What the text check found in the picture a map shows now (`imageUrl`, null without one). */
export type MindMapImageCheck = { imageUrl: string | null; passed: boolean; problems: string[] };

/**
 * Checks the words on the picture the map shows, read back from where it's stored, after learners
 * can already see it: it fails only on a serious problem (garbled or misspelled text, a part left
 * out), and its problems quote the words for the next drawing. A map without a picture passes.
 *
 * This is a workflow bridge, not an app authorization boundary.
 */
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

/**
 * Takes a picture whose text failed its check again off the map, which is then its outline. A
 * picture drawn since is left alone. The file stays where it is, so a learner who has it open
 * keeps reading it.
 *
 * This is a workflow bridge, not an app authorization boundary.
 */
export async function removeChapterMindMapImage({
  chapterId,
  imageUrl,
}: {
  chapterId: string;
  imageUrl: string;
}): Promise<void> {
  await prisma.chapterMindMap.updateMany({ data: NO_IMAGE, where: { chapterId, imageUrl } });
}

/**
 * Marks the run's map as failed after its last retry, so the learner can ask again. A map another
 * run has taken over since is left alone.
 *
 * This is a workflow bridge, not an app authorization boundary.
 */
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
