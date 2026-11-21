import "server-only";
import { type OnboardingDraft, prisma } from "@zoonk/db";
import { type MaterialSource } from "../../../library/sources/material-pages";
import { type DraftSource } from "../onboarding-contract";

type DraftMaterialKey = Pick<OnboardingDraft, "sourceIds" | "userId">;

/** The sent ids that are the learner's own uploads, in the order sent, each once. */
export async function findOwnUploadIds({
  sourceIds,
  userId,
}: {
  sourceIds: readonly string[];
  userId: string;
}): Promise<string[]> {
  const ids = [...new Set(sourceIds)];

  if (ids.length === 0) {
    return [];
  }

  const uploads = await prisma.learnerSource.findMany({
    select: { sourceId: true },
    where: { origin: "upload", sourceId: { in: ids }, userId },
  });

  const own = new Set(uploads.map((upload) => upload.sourceId));
  return ids.filter((id) => own.has(id));
}

/** Sharing an upload can leave a draft holding the same id twice. */
function inDraftOrder<TSource extends { id: string }>({
  draft,
  sources,
}: {
  draft: DraftMaterialKey;
  sources: TSource[];
}): TSource[] {
  return [...new Set(draft.sourceIds)].flatMap(
    (id) => sources.find((source) => source.id === id) ?? [],
  );
}

export async function readDraftSources(draft: DraftMaterialKey): Promise<DraftSource[]> {
  if (draft.sourceIds.length === 0) {
    return [];
  }

  const links = await prisma.learnerSource.findMany({
    select: { source: { select: { id: true, title: true } } },
    where: { sourceId: { in: draft.sourceIds }, userId: draft.userId },
  });

  return inDraftOrder({ draft, sources: links.map((link) => link.source) });
}

/** Internal: the run reading the draft holds its learner's authorization. */
export async function loadDraftMaterial(draft: DraftMaterialKey): Promise<MaterialSource[]> {
  if (draft.sourceIds.length === 0) {
    return [];
  }

  const links = await prisma.learnerSource.findMany({
    select: {
      source: {
        select: { contentHash: true, extractedText: true, id: true, mimeType: true, title: true },
      },
    },
    where: {
      source: { extractedText: { not: null } },
      sourceId: { in: draft.sourceIds },
      userId: draft.userId,
    },
  });

  return inDraftOrder({ draft, sources: links.map((link) => link.source) }).flatMap(
    ({ extractedText, ...source }) => (extractedText ? [{ ...source, text: extractedText }] : []),
  );
}
