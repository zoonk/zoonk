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

/**
 * `existing`: reuse this row (`match` says how it was found, `probability` is
 * the reuse decision's estimate for search matches).
 * `generate`: nothing fits; create the row under `identityKey` so the next
 * request finds it by exact match, and so concurrent requests share one row.
 * `verdicts` lists every candidate the decision judged, for logs and tuning.
 */
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

/**
 * Loads each kind's candidates by id. A candidate reads the same for every request that found it,
 * so requests resolved together load their candidates in one call per kind.
 */
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

/**
 * Postgres full-text search for public rows with the same language and level, on the item's own
 * words and the terms the model wrote for it. Returns the ids it found, best first.
 */
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

/** Every candidate the searches found, by id, loaded once per kind. */
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

/** A Jev decision on the candidates a search found, best first. */
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

/**
 * The terms of the requests that search, by entry: the ones the caller already wrote, or one
 * model call for all of them (a few for many; see `writeSearchTerms`).
 */
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

/**
 * Private requests never search, and neither does a lesson whose skills are all new: no Library
 * lesson can teach them yet.
 */
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

/**
 * Finds the Library items that already teach what each request needs, or says to generate them.
 * One flow serves courses, chapters, lessons, skills, sources and images: an exact identity-key
 * match first, then model-written search terms, Postgres text search filtered by language and
 * level, and one Jev decision on its candidates. Requests known together, such as a chapter's
 * lessons, resolve together: the terms of every request still unmatched are written in one model
 * call instead of one each, the candidates their searches find load in one call per kind, and the
 * results come back in the order of the requests. A caller that
 * already wrote the terms, beside other work, passes them in `searchTerms`, in the same order.
 * Private requests only match their owner's own rows: they are never reused and never reuse
 * other learners' private content. A lesson whose skills were all just created (`newSkills`) only
 * matches exactly, with no search or reuse decision.
 *
 * This is a workflow bridge, not an app authorization boundary: it accepts owner ids only because
 * the public core boundary that started the workflow derived them from the authenticated session.
 */
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

/** `resolveLibraryIdentities` for one request, for callers that find one item at a time. */
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
