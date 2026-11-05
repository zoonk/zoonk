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

/** Longer than a drawing step and its retries take, so only a run that died loses its claim. */
const STALE_CLAIM_MS = 600_000;

export type IconRow = { id: string; name: string; runId: string; status: GenerationStatus };

const iconRowSelect = { id: true, name: true, runId: true, status: true } as const;

export function findIconsByName(names: readonly string[]): Promise<IconRow[]> {
  return names.length === 0
    ? Promise.resolve([])
    : prisma.lessonIcon.findMany({ select: iconRowSelect, where: { name: { in: [...names] } } });
}

export function findIconsById(ids: readonly string[]): Promise<IconRow[]> {
  return ids.length === 0
    ? Promise.resolve([])
    : prisma.lessonIcon.findMany({ select: iconRowSelect, where: { id: { in: [...ids] } } });
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

/**
 * One run draws each name: the unique name decides who claimed it first, and a claim whose run
 * stopped long ago passes to the next run that needs it.
 */
export async function claimLessonIcon({
  need,
  runId,
}: {
  need: IconNeed;
  runId: string;
}): Promise<IconRow & { mine: boolean }> {
  const now = new Date();
  const stale = new Date(now.getTime() - STALE_CLAIM_MS);

  await prisma.$executeRaw`
    INSERT INTO lesson_icons (name, tags, description, run_id, style_version, created_at, updated_at)
    VALUES (${need.name}, ${need.searchWords}::text[], ${need.description}, ${runId}, ${LESSON_ICON_STYLE_VERSION}, ${now}, ${now})
    ON CONFLICT (name) DO UPDATE SET run_id = EXCLUDED.run_id, updated_at = EXCLUDED.updated_at
    WHERE lesson_icons.status = 'running' AND lesson_icons.updated_at < ${stale}`;

  const icon = await prisma.lessonIcon.findUniqueOrThrow({
    select: iconRowSelect,
    where: { name: need.name },
  });

  return { ...icon, mine: icon.status === "running" && icon.runId === runId };
}

/** Internal workflow bridge. Draws a claimed icon once; another run's claim is left alone. */
export async function drawLessonIcon({
  analytics,
  iconId,
  runId,
}: {
  analytics?: AiGenerationContext;
  iconId: string;
  runId: string;
}): Promise<GenerationStatus | null> {
  const icon = await prisma.lessonIcon.findUnique({ where: { id: iconId } });

  if (!icon || icon.status !== "running" || icon.runId !== runId) {
    return icon?.status ?? null;
  }

  const { data, provenance } = await generateLessonIconImage({ analytics, need: icon });
  const files = await toIconFiles(data.image.uint8Array);
  const slug = icon.name.replaceAll(" ", "-");

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

  const saved = await prisma.lessonIcon.updateMany({
    data: {
      generatedAt: new Date(provenance.generatedAt),
      model: provenance.model,
      promptVersion: provenance.promptVersion,
      smallUrl: small.data,
      status: "completed",
      url: large.data,
    },
    where: { id: iconId, runId, status: "running" },
  });

  return saved.count > 0 ? "completed" : null;
}

/** After its step's retries, so later lessons skip the name instead of paying for it again. */
export async function failLessonIcon({ iconId, runId }: { iconId: string; runId: string }) {
  await prisma.lessonIcon.updateMany({
    data: { status: "failed" },
    where: { id: iconId, runId, status: "running" },
  });
}
