import "server-only";
import { type OnboardingDraft, prisma } from "@zoonk/db";
import { type MaterialSource } from "../../../library/sources/material-pages";
import { findOwnSources } from "../../../library/sources/own-sources";
import { type DraftSource } from "../onboarding-contract";

type DraftMaterialKey = Pick<OnboardingDraft, "sourceIds" | "userId">;

function inOrder<TSource extends { id: string }>({
  ids,
  sources,
}: {
  ids: readonly string[];
  sources: TSource[];
}): TSource[] {
  return ids.flatMap((id) => sources.find((source) => source.id === id) ?? []);
}

function findDraftUploads(draft: DraftMaterialKey) {
  return findOwnSources({ origin: "upload", sourceIds: draft.sourceIds, userId: draft.userId });
}

/** The draft's uploads with text to read, which the words are read with; `materialMissing` when one has none or is gone. */
export async function readDraftSources(
  draft: DraftMaterialKey,
): Promise<{ materialMissing: boolean; sources: DraftSource[] }> {
  if (draft.sourceIds.length === 0) {
    return { materialMissing: false, sources: [] };
  }

  const uploads = await findDraftUploads(draft);

  const readable = await prisma.source.findMany({
    select: { id: true, title: true },
    where: { extractedText: { not: null }, id: { in: uploads.resolved } },
  });

  const sources = inOrder({ ids: uploads.resolved, sources: readable });
  const materialMissing = uploads.unresolved.length > 0 || sources.length < uploads.resolved.length;

  return { materialMissing, sources };
}

/** Internal: the run reading the draft holds its learner's authorization. */
export async function loadDraftMaterial(draft: DraftMaterialKey): Promise<MaterialSource[]> {
  if (draft.sourceIds.length === 0) {
    return [];
  }

  const { resolved } = await findDraftUploads(draft);

  const sources = await prisma.source.findMany({
    select: { contentHash: true, extractedText: true, id: true, mimeType: true, title: true },
    where: { extractedText: { not: null }, id: { in: resolved } },
  });

  return inOrder({ ids: resolved, sources }).flatMap(({ extractedText, ...source }) =>
    extractedText ? [{ ...source, text: extractedText }] : [],
  );
}
