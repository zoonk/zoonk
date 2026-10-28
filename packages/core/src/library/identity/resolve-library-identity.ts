import "server-only";
import {
  type LibraryIdentityVerdict,
  decideLibraryIdentity,
} from "@zoonk/ai/tasks/v2/identity/decision";
import { type SearchTermsParams } from "@zoonk/ai/tasks/v2/identity/search-terms";
import { type LibraryIdentityCandidate } from "@zoonk/ai/tasks/v2/identity/subject";
import { type IdentityKindSearch, type LibraryIdentityRequest } from "./_utils/identity-requests";
import { toTextSearch } from "./_utils/text-search-sql";
import { getChapterIdentitySearch, loadChapterCandidates } from "./kinds/chapter-identity";
import { getCourseIdentitySearch, loadCourseCandidates } from "./kinds/course-identity";
import { getImageIdentitySearch, loadImageCandidates } from "./kinds/image-identity";
import { getLessonIdentitySearch, loadLessonCandidates } from "./kinds/lesson-identity";
import { getSkillIdentitySearch, loadSkillCandidates } from "./kinds/skill-identity";
import { getSourceIdentitySearch, loadSourceCandidates } from "./kinds/source-identity";
import { writeSearchTerms } from "./write-search-terms";

export type LibraryIdentityResolution =
  | {
      kind: "existing";
      id: string;
      match: "exact" | "search";
      probability: number | null;
      verdicts: LibraryIdentityVerdict[];
    }
  | {
      kind: "generate";
      identityKey: string;
      searchTerms: string[];
      verdicts: LibraryIdentityVerdict[];
    };

function getIdentitySearch(request: LibraryIdentityRequest): IdentityKindSearch {
  switch (request.kind) {
    case "chapter":
      return getChapterIdentitySearch(request);
    case "course":
      return getCourseIdentitySearch(request);
    case "image":
      return getImageIdentitySearch(request);
    case "lesson":
      return getLessonIdentitySearch(request);
    case "skill":
      return getSkillIdentitySearch(request);
    case "source":
      return getSourceIdentitySearch(request);
    default:
      throw new Error("Unknown Library identity kind.");
  }
}

const CANDIDATE_LOADERS: Record<
  LibraryIdentityRequest["kind"],
  (ids: readonly string[]) => Promise<LibraryIdentityCandidate[]>
> = {
  chapter: loadChapterCandidates,
  course: loadCourseCandidates,
  image: loadImageCandidates,
  lesson: loadLessonCandidates,
  skill: loadSkillCandidates,
  source: loadSourceCandidates,
};

type IdentityAnalytics = SearchTermsParams["analytics"];

async function findCandidateIds({
  search,
  terms,
}: {
  search: IdentityKindSearch;
  terms: readonly string[];
}): Promise<{ ids: string[]; searchTerms: string[] }> {
  const searchTerms = [...search.baseTerms, ...terms];
  const textSearch = toTextSearch({ language: search.aiSubject.language, terms: searchTerms });
  const ids = textSearch ? await search.findCandidateIds(textSearch) : [];

  return { ids, searchTerms };
}

async function loadCandidates(
  searched: readonly { ids: readonly string[]; kind: LibraryIdentityRequest["kind"] }[],
): Promise<Map<string, LibraryIdentityCandidate>> {
  const kinds = [...new Set(searched.map((entry) => entry.kind))];

  const found = kinds
    .map((kind) => ({
      ids: [
        ...new Set(searched.filter((entry) => entry.kind === kind).flatMap((entry) => entry.ids)),
      ],
      kind,
    }))
    .filter(({ ids }) => ids.length > 0);

  const loaded = await Promise.all(found.map(({ ids, kind }) => CANDIDATE_LOADERS[kind](ids)));

  return new Map(loaded.flat().map((candidate) => [candidate.id, candidate]));
}

async function decideIdentity({
  analytics,
  candidates,
  search,
  searchTerms,
}: {
  analytics?: IdentityAnalytics;
  candidates: readonly LibraryIdentityCandidate[];
  search: IdentityKindSearch;
  searchTerms: string[];
}): Promise<LibraryIdentityResolution> {
  const generate = {
    identityKey: search.identityKey,
    kind: "generate" as const,
    searchTerms,
    verdicts: [],
  };

  if (candidates.length === 0) {
    return generate;
  }

  const { match, verdicts } = await decideLibraryIdentity({
    analytics,
    candidates: [...candidates],
    subject: search.aiSubject,
  });

  if (match) {
    const { id, probability } = match;
    return { id, kind: "existing", match: "search", probability, verdicts };
  }

  return { ...generate, verdicts };
}

type IdentityEntry = {
  exactId: string | null;
  index: number;
  request: LibraryIdentityRequest;
  search: IdentityKindSearch;
};

async function getSearchTerms({
  analytics,
  searchTerms,
  searching,
}: {
  analytics?: IdentityAnalytics;
  searchTerms?: readonly (readonly string[])[];
  searching: readonly IdentityEntry[];
}): Promise<Map<IdentityEntry, readonly string[]>> {
  if (searchTerms) {
    return new Map(searching.map((entry) => [entry, searchTerms[entry.index] ?? []]));
  }

  const written = await writeSearchTerms({
    analytics,
    subjects: searching.map((entry) => entry.search.aiSubject),
  });

  return new Map(searching.map((entry, position) => [entry, written[position] ?? []]));
}

function isSearched(entry: IdentityEntry): boolean {
  const { request } = entry;
  const isNewLesson = request.kind === "lesson" && request.newSkills === true;

  return !entry.exactId && !request.ownerId && !isNewLesson;
}

function resolveUnsearched(entry: IdentityEntry): LibraryIdentityResolution {
  if (entry.exactId) {
    return { id: entry.exactId, kind: "existing", match: "exact", probability: null, verdicts: [] };
  }

  return { identityKey: entry.search.identityKey, kind: "generate", searchTerms: [], verdicts: [] };
}

/** Internal workflow bridge: owner ids must come from the authenticated public boundary. Results preserve request order. */
export async function resolveLibraryIdentities({
  analytics,
  requests,
  searchTerms,
}: {
  analytics?: IdentityAnalytics;
  requests: readonly LibraryIdentityRequest[];
  searchTerms?: readonly (readonly string[])[];
}): Promise<LibraryIdentityResolution[]> {
  const entries = await Promise.all(
    requests.map(async (request, index): Promise<IdentityEntry> => {
      const search = getIdentitySearch(request);
      return { exactId: await search.findExact(), index, request, search };
    }),
  );

  const searching = entries.filter((entry) => isSearched(entry));
  const terms = await getSearchTerms({ analytics, searchTerms, searching });

  const searches = await Promise.all(
    searching.map(async (entry) => ({
      entry,
      ...(await findCandidateIds({ search: entry.search, terms: terms.get(entry) ?? [] })),
    })),
  );

  const candidates = await loadCandidates(
    searches.map(({ entry, ids }) => ({ ids, kind: entry.request.kind })),
  );

  const searched = new Map(searches.map((found) => [found.entry, found]));

  return Promise.all(
    entries.map(async (entry) => {
      const found = searched.get(entry);

      if (!found) {
        return resolveUnsearched(entry);
      }

      return decideIdentity({
        analytics,
        candidates: found.ids.flatMap((id) => candidates.get(id) ?? []),
        search: entry.search,
        searchTerms: found.searchTerms,
      });
    }),
  );
}

export async function resolveLibraryIdentity({
  analytics,
  request,
}: {
  analytics?: IdentityAnalytics;
  request: LibraryIdentityRequest;
}): Promise<LibraryIdentityResolution> {
  const [resolution] = await resolveLibraryIdentities({ analytics, requests: [request] });

  if (!resolution) {
    throw new Error("Library identity resolution returned no result.");
  }

  return resolution;
}
