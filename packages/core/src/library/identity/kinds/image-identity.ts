import "server-only";
import { type LibraryIdentityCandidate } from "@zoonk/ai/tasks/v2/identity/subject";
import { prisma, sql } from "@zoonk/db";
import {
  buildImageReuseKey,
  getImageReuseKeyPrefix,
  scopeIdentityKey,
} from "@zoonk/utils/identity-key";
import { isInRequestScope } from "../_utils/exact-match-scope";
import { type IdentityKindSearch, type ImageIdentityRequest } from "../_utils/identity-requests";
import { IMAGE_SCENE_DOCUMENT } from "../_utils/search-documents";
import { type TextSearch, findRankedIds } from "../_utils/text-search-sql";

/** Scenes are written in English whatever the lesson's language, so they're searched in English. */
const SCENE_LANGUAGE = "en";

async function findExactImage({
  request,
  reuseKey,
}: {
  request: ImageIdentityRequest;
  reuseKey: string;
}): Promise<string | null> {
  const asset = await prisma.mediaAsset.findUnique({
    select: { id: true, kind: true, ownerId: true, visibility: true },
    where: { reuseKey },
  });

  if (asset?.kind !== "image" || !isInRequestScope({ ownerId: request.ownerId, row: asset })) {
    return null;
  }

  return asset.id;
}

/**
 * Public images in the same style whose scene matches. Images
 * without text serve any language; images with labels only their own, and
 * never a language course, which shows no text.
 */
async function findImageCandidateIds({
  request,
  search,
}: {
  request: ImageIdentityRequest;
  search: TextSearch;
}): Promise<string[]> {
  const keyPrefix = getImageReuseKeyPrefix(request);

  // A scene is English whatever language its labels are in.
  return findRankedIds({
    document: IMAGE_SCENE_DOCUMENT,
    filters: sql`m.kind = 'image'
      AND m.visibility = 'public'
      AND m.prompt IS NOT NULL
      AND m.style_version = ${request.styleVersion}
      AND starts_with(m.reuse_key, ${keyPrefix})
      AND (m.language IS NULL OR (${request.textAllowed} AND m.language = ${request.language}))`,
    search,
  });
}

export async function loadImageCandidates(
  ids: readonly string[],
): Promise<LibraryIdentityCandidate[]> {
  const assets = await prisma.mediaAsset.findMany({ where: { id: { in: [...ids] } } });

  return assets.map((asset) => ({ id: asset.id, item: { title: asset.prompt ?? "" } }));
}

export function getImageIdentitySearch(request: ImageIdentityRequest): IdentityKindSearch {
  const reuseKey = scopeIdentityKey({
    key: buildImageReuseKey({
      language: request.hasLabels ? request.language : null,
      prompt: request.prompt,
      styleVersion: request.styleVersion,
    }),
    ownerId: request.ownerId,
  });

  return {
    aiSubject: {
      goal: request.goal,
      item: { title: request.prompt },
      kind: "image",
      language: SCENE_LANGUAGE,
    },
    baseTerms: [],
    findCandidateIds: (search) => findImageCandidateIds({ request, search }),
    findExact: () => findExactImage({ request, reuseKey }),
    identityKey: reuseKey,
  };
}
