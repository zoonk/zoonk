import "server-only";
import { type OnboardingDraft, prisma } from "@zoonk/db";
import { type MaterialSource } from "../../../library/sources/material-pages";
import { findOwnSources } from "../../../library/sources/own-sources";
import {
  materialSourceFields,
  toReadableMaterial,
} from "../../../library/sources/readable-material";
import { getSourceReadStatus } from "../../../library/sources/source-read-status";
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

/** The draft's uploads the goal is created with; `materialMissing` when one is gone. */
export async function readDraftSources(
  draft: DraftMaterialKey,
): Promise<{ materialMissing: boolean; sources: DraftSource[] }> {
  if (draft.sourceIds.length === 0) {
    return { materialMissing: false, sources: [] };
  }

  const uploads = await findDraftUploads(draft);

  const found = await prisma.source.findMany({
    select: { extractedText: true, id: true, readState: true, title: true },
    where: { id: { in: uploads.resolved } },
  });

  return {
    materialMissing: uploads.unresolved.length > 0 || found.length !== uploads.resolved.length,
    sources: inOrder({ ids: uploads.resolved, sources: found }).map((source) => ({
      id: source.id,
      readStatus: getSourceReadStatus(source),
      title: source.title,
    })),
  };
}

/** Internal: the run reading the draft holds its learner's authorization. */
export async function loadDraftMaterial(draft: DraftMaterialKey): Promise<MaterialSource[]> {
  if (draft.sourceIds.length === 0) {
    return [];
  }

  const { resolved } = await findDraftUploads(draft);

  const sources = await prisma.source.findMany({
    select: materialSourceFields,
    where: { extractedText: { not: null }, id: { in: resolved } },
  });

  return toReadableMaterial(inOrder({ ids: resolved, sources }));
}
