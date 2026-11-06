import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { LESSON_ICON_STYLE_VERSION, generateLessonIconImage } from "@zoonk/ai/tasks/icons/image";
import { type IconCandidate } from "@zoonk/ai/tasks/icons/match";
import { type IconNeed } from "@zoonk/ai/tasks/icons/need";
import { type GenerationStatus, prisma, sql } from "@zoonk/db";
import { uploadImage } from "../../images/upload-image";
import { LESSON_ICON_DOCUMENT } from "../identity/_utils/search-documents";
import { findRankedIds, orderByIds, toTextSearch } from "../identity/_utils/text-search-sql";
import { toIconFiles } from "./_utils/icon-files";

export type IconRow = { id: string; name: string; status: GenerationStatus };

const iconRowSelect = { id: true, name: true, status: true } as const;

type DrawnFiles = {
  generatedAt: Date;
  model: string;
  promptVersion: string;
  smallUrl: string;
  url: string;
};

export function findIconsByName(names: readonly string[]): Promise<IconRow[]> {
  return names.length === 0
    ? Promise.resolve([])
    : prisma.lessonIcon.findMany({ select: iconRowSelect, where: { name: { in: [...names] } } });
}

export async function searchIconCandidates(need: IconNeed): Promise<IconCandidate[]> {
  const search = toTextSearch({
    language: "en",
    terms: [need.name, ...need.name.split(" "), ...need.searchWords],
  });

  if (!search) {
    return [];
  }

  const ids = await findRankedIds({
    document: LESSON_ICON_DOCUMENT,
    filters: sql`i.status = 'completed'`,
    search,
  });

  const icons = await prisma.lessonIcon.findMany({
    select: { description: true, id: true, name: true, tags: true },
    where: { id: { in: ids } },
  });

  return orderByIds(ids, icons);
}

export type IconClaim = { claimed: boolean; iconId: string; need: IconNeed };

/**
 * Internal workflow bridge: inserts a running row for each new name, and only the run whose insert
 * won draws it, including after a retry of its claim step; the others link the row as it is, and
 * lessons show its icon once it's completed. A draw that never finishes leaves its row running and
 * the name without an icon, as a failed draw does: no run takes the claim over or waits for it.
 */
export async function claimLessonIcons({
  needs,
  runId,
}: {
  needs: readonly IconNeed[];
  runId: string;
}): Promise<IconClaim[]> {
  await prisma.lessonIcon.createMany({
    data: needs.map((need) => ({
      description: need.description,
      name: need.name,
      runId,
      status: "running" as const,
      styleVersion: LESSON_ICON_STYLE_VERSION,
      tags: need.searchWords,
    })),
    skipDuplicates: true,
  });

  const rows = await prisma.lessonIcon.findMany({
    select: { id: true, name: true, runId: true },
    where: { name: { in: needs.map((need) => need.name) } },
  });

  const byName = new Map(rows.map((icon) => [icon.name, icon]));

  return needs.flatMap((need) => {
    const icon = byName.get(need.name);
    return icon ? [{ claimed: icon.runId === runId, iconId: icon.id, need }] : [];
  });
}

async function drawFiles({
  analytics,
  need,
}: {
  analytics?: AiGenerationContext;
  need: IconNeed;
}): Promise<DrawnFiles> {
  const { data, provenance } = await generateLessonIconImage({ analytics, need });
  const files = await toIconFiles(data.image.uint8Array);
  const slug = need.name.replaceAll(" ", "-");

  const [large, small] = await Promise.all([
    uploadImage({ fileName: `library/icons/${slug}-256.webp`, image: files.large }),
    uploadImage({ fileName: `library/icons/${slug}-96.webp`, image: files.small }),
  ]);

  if (large.error) {
    throw large.error;
  }

  if (small.error) {
    throw small.error;
  }

  return {
    generatedAt: new Date(provenance.generatedAt),
    model: provenance.model,
    promptVersion: provenance.promptVersion,
    smallUrl: small.data,
    url: large.data,
  };
}

/** Internal workflow bridge: draws a name this run claimed and completes its row. */
export async function drawLessonIcon({
  analytics,
  iconId,
  need,
}: {
  analytics?: AiGenerationContext;
  iconId: string;
  need: IconNeed;
}): Promise<void> {
  const icon = await prisma.lessonIcon.findUnique({
    select: { status: true },
    where: { id: iconId },
  });

  // A step replayed after its row completed has nothing left to draw.
  if (icon?.status !== "running") {
    return;
  }

  const drawn = await drawFiles({ analytics, need });

  await prisma.lessonIcon.updateMany({
    data: { ...drawn, status: "completed" },
    where: { id: iconId, status: "running" },
  });
}

/** After its draw step's retries, so later lessons skip the name instead of paying for it again. */
export async function failLessonIcon(iconId: string): Promise<void> {
  await prisma.lessonIcon.updateMany({
    data: { status: "failed" },
    where: { id: iconId, status: "running" },
  });
}
