import "server-only";
import { type LibraryIdentityCandidate } from "@zoonk/ai/tasks/v2/identity/subject";
import { prisma, sql } from "@zoonk/db";
import { buildSourceIdentityKey, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { READABLE_SOURCE_FILTER } from "../../sources/_utils/readable-sources";
import { isInRequestScope } from "../_utils/exact-match-scope";
import { type IdentityKindSearch, type SourceIdentityRequest } from "../_utils/identity-requests";
import { SOURCE_DOCUMENT } from "../_utils/search-documents";
import { type TextSearch, findRankedIds } from "../_utils/text-search-sql";

async function findExactSource({
  identityKey,
  request,
}: {
  identityKey: string;
  request: SourceIdentityRequest;
}): Promise<string | null> {
  const source = await prisma.source.findUnique({
    select: { id: true, ownerId: true, visibility: true },
    where: { languageIdentity: { identityKey, language: request.language } },
  });

  return source && isInRequestScope({ ownerId: request.ownerId, row: source }) ? source.id : null;
}

/**
 * Public sources in the same language whose title, publisher or URL match: mirrors and re-uploads.
 * A copy that stored no text is never one, or research would read an empty page instead of
 * fetching the document it found.
 */
async function findSourceCandidateIds({
  request,
  search,
}: {
  request: SourceIdentityRequest;
  search: TextSearch;
}): Promise<string[]> {
  return findRankedIds({
    document: SOURCE_DOCUMENT,
    filters: sql`s.language = ${request.language}
      AND s.visibility = 'public'
      AND ${READABLE_SOURCE_FILTER}`,
    search,
  });
}

export async function loadSourceCandidates(
  ids: readonly string[],
): Promise<LibraryIdentityCandidate[]> {
  const sources = await prisma.source.findMany({
    omit: { extractedText: true, structure: true },
    where: { id: { in: [...ids] } },
  });

  return sources.map((source) => ({
    id: source.id,
    item: { publisher: source.publisher, title: source.title, url: source.url },
  }));
}

export function getSourceIdentitySearch(request: SourceIdentityRequest): IdentityKindSearch {
  const identityKey = scopeIdentityKey({
    key: buildSourceIdentityKey(request),
    ownerId: request.ownerId,
  });

  return {
    aiSubject: {
      goal: request.goal,
      item: { publisher: request.publisher, title: request.title, url: request.url },
      kind: "source",
      language: request.language,
    },
    baseTerms: [request.title],
    findCandidateIds: (search) => findSourceCandidateIds({ request, search }),
    findExact: () => findExactSource({ identityKey, request }),
    identityKey,
  };
}
