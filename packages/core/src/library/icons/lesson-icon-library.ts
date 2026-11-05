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

/**
 * Each draw attempt renews the claim and ends within `DRAW_ATTEMPT_MS` (a drawing takes about 10
 * seconds), so a run still drawing renews long before its claim goes stale; only one that stopped
 * loses it.
 */
const STALE_CLAIM_MS = 600_000;
const DRAW_ATTEMPT_MS = 180_000;

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

/**
 * Ends the attempt on time whatever the work does: Blob retries a `TimeoutError` for minutes, so the
 * abort carries an `AbortError`, which it and the AI SDK stop on.
 */
function withinAttempt<T>(work: (abortSignal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timedOut = new DOMException("The icon drawing ran out of time", "AbortError");

  const deadline = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener("abort", () => reject(timedOut));
  });

  const timer = setTimeout(() => controller.abort(timedOut), DRAW_ATTEMPT_MS);

  return Promise.race([work(controller.signal), deadline]).finally(() => clearTimeout(timer));
}

async function drawIconFiles({
  abortSignal,
  analytics,
  icon,
}: {
  abortSignal: AbortSignal;
  analytics?: AiGenerationContext;
  icon: { description: string; name: string };
}) {
  const { data, provenance } = await generateLessonIconImage({
    abortSignal,
    analytics,
    need: icon,
  });

  const files = await toIconFiles(data.image.uint8Array);
  const slug = icon.name.replaceAll(" ", "-");

  const [large, small] = await Promise.all([
    uploadImage({ abortSignal, fileName: `library/icons/${slug}-256.webp`, image: files.large }),
    uploadImage({ abortSignal, fileName: `library/icons/${slug}-96.webp`, image: files.small }),
  ]);

  if (large.error) {
    throw large.error;
  }

  if (small.error) {
    throw small.error;
  }

  return { files: { smallUrl: small.data, url: large.data }, provenance };
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
  const renewed = await prisma.lessonIcon.updateMany({
    data: { updatedAt: new Date() },
    where: { id: iconId, runId, status: "running" },
  });

  const icon = await prisma.lessonIcon.findUnique({ where: { id: iconId } });

  if (!icon || renewed.count === 0) {
    return icon?.status ?? null;
  }

  const { files, provenance } = await withinAttempt((abortSignal) =>
    drawIconFiles({ abortSignal, analytics, icon }),
  );

  const saved = await prisma.lessonIcon.updateMany({
    data: {
      generatedAt: new Date(provenance.generatedAt),
      model: provenance.model,
      promptVersion: provenance.promptVersion,
      smallUrl: files.smallUrl,
      status: "completed",
      url: files.url,
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
