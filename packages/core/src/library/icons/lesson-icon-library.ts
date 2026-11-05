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

async function keepIcon({
  drawn,
  need,
}: {
  drawn: DrawnFiles | null;
  need: IconNeed;
}): Promise<IconRow> {
  // Two lessons drawing a new name at once both pay for a drawing: the first row stays, and the
  // other run's uploaded files are left unused.
  await prisma.lessonIcon.createMany({
    data: {
      description: need.description,
      name: need.name,
      status: drawn ? "completed" : "failed",
      styleVersion: LESSON_ICON_STYLE_VERSION,
      tags: need.searchWords,
      ...drawn,
    },
    skipDuplicates: true,
  });

  return prisma.lessonIcon.findUniqueOrThrow({ select: iconRowSelect, where: { name: need.name } });
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

/** Internal workflow bridge: the library's row for the name, drawn first when it has none. */
export async function drawLessonIcon({
  analytics,
  need,
}: {
  analytics?: AiGenerationContext;
  need: IconNeed;
}): Promise<IconRow> {
  const existing = await prisma.lessonIcon.findUnique({
    select: iconRowSelect,
    where: { name: need.name },
  });

  return existing ?? keepIcon({ drawn: await drawFiles({ analytics, need }), need });
}

/** After its step's retries, so later lessons skip the name instead of paying for it again. */
export function failLessonIcon(need: IconNeed): Promise<IconRow> {
  return keepIcon({ drawn: null, need });
}
